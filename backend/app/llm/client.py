from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class LLMClient(ABC):
    """Abstract provider-independent interface for LLM extraction operations."""

    @abstractmethod
    def extract_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[BaseModel],
    ) -> tuple[dict[str, Any], int | None, int | None]:
        """Send prompt to LLM and return (parsed_dict, tokens_in, tokens_out).

        Must raise AIProviderError on failure or timeout, and AIUnavailableError if credentials missing.
        """
        pass

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Estimate or calculate the token count for a text block."""
        pass

