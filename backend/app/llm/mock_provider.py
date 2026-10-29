from typing import Any

from pydantic import BaseModel

from app.core.exceptions import AIProviderError
from app.llm.client import LLMClient


class MockLLMClient(LLMClient):
    """Configurable mock LLM provider for unit and regression testing."""

    def __init__(
        self,
        canned_response: dict[str, Any] | None = None,
        fail_times: int = 0,
        fail_error: Exception | None = None,
    ):
        self.canned_response = canned_response or {
            "tasks": [],
            "decisions": [],
            "risks": [],
            "open_questions": [],
        }
        self.fail_times = fail_times
        self.fail_error = fail_error or AIProviderError("Simulated LLM provider error")
        self.call_count = 0
        self.recorded_prompts: list[tuple[str, str]] = []

    def extract_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> tuple[dict[str, Any], int | None, int | None]:
        self.call_count += 1
        self.recorded_prompts.append((system_prompt, user_prompt))

        if self.call_count <= self.fail_times:
            raise self.fail_error

        # Return mock payload with sample token usage
        return self.canned_response, 120, 85

    def count_tokens(self, text: str) -> int:
        return max(1, len(text) // 4)

