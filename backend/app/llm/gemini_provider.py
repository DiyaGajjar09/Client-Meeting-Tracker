import json
import logging
from typing import Any

from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import AIProviderError, AIUnavailableError
from app.llm.client import LLMClient

logger = logging.getLogger(__name__)


class GeminiProvider(LLMClient):
    """Google Gemini AI implementation using official google-genai SDK."""

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
        temperature: float | None = None,
        timeout: int | None = None,
    ):
        self.api_key = (api_key or settings.GEMINI_API_KEY or "").strip()
        self.model_name = model_name or settings.GEMINI_MODEL
        self.temperature = temperature if temperature is not None else settings.LLM_TEMPERATURE
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

        if not self.api_key:
            self._client = None
        else:
            try:
                from google import genai

                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Failed to initialize Google GenAI client: {e}")
                self._client = None

    def _ensure_client(self):
        if not self.api_key or not self._client:
            raise AIUnavailableError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in your environment."
            )

    def extract_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> tuple[dict[str, Any], int | None, int | None]:
        self._ensure_client()

        from google.genai import types
        from google.genai.errors import APIError

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=self.temperature,
            response_mime_type="application/json",
            response_schema=response_model,
        )

        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=user_prompt,
                config=config,
            )
        except APIError as api_err:
            status_code = getattr(api_err, "code", 502) or 502
            # Mask API key if present in error message
            safe_msg = str(api_err).replace(self.api_key, "[REDACTED]")
            logger.error(f"Gemini API error ({status_code}): {safe_msg}")
            raise AIProviderError(
                message=f"Gemini upstream error: {safe_msg}",
                status_code=502 if status_code == 500 else status_code,
            ) from api_err
        except Exception as exc:
            safe_msg = str(exc).replace(self.api_key, "[REDACTED]")
            logger.error(f"Unexpected error communicating with Gemini: {safe_msg}")
            raise AIProviderError(
                message=f"Failed to connect to Gemini provider: {safe_msg}",
                status_code=502,
            ) from exc

        raw_text = response.text or ""
        tokens_in = None
        tokens_out = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_in = getattr(response.usage_metadata, "prompt_token_count", None)
            tokens_out = getattr(response.usage_metadata, "candidates_token_count", None)

        try:
            parsed = json.loads(raw_text)
            return parsed, tokens_in, tokens_out
        except json.JSONDecodeError as jde:
            logger.error(f"Gemini returned non-JSON response: {jde}")
            raise AIProviderError(
                message="Gemini returned invalid or unparseable JSON output.",
                status_code=502,
                detail=str(jde),
            ) from jde

    def count_tokens(self, text: str) -> int:
        if not self._client or not self.api_key:
            # Safe token estimation: 1 token ~= 4 chars for English prose
            return max(1, len(text) // 4)

        try:
            res = self._client.models.count_tokens(
                model=self.model_name,
                contents=text,
            )
            return getattr(res, "total_tokens", len(text) // 4)
        except Exception:
            return max(1, len(text) // 4)
