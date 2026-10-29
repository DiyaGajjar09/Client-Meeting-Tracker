from app.core.config import settings
from app.llm.client import LLMClient
from app.llm.gemini_provider import GeminiProvider
from app.llm.mock_provider import MockLLMClient

_override_client: LLMClient | None = None


def set_llm_client_override(client: LLMClient | None) -> None:
    """Set a mock or alternate LLM client for tests."""
    global _override_client
    _override_client = client


def get_llm_client(custom_model: str | None = None) -> LLMClient:
    """Factory function returning the active LLM client."""
    global _override_client
    if _override_client is not None:
        return _override_client

    return GeminiProvider(model_name=custom_model or settings.GEMINI_MODEL)


__all__ = [
    "LLMClient",
    "GeminiProvider",
    "MockLLMClient",
    "get_llm_client",
    "set_llm_client_override",
]

