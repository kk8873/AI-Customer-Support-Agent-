"""Shared FastAPI dependencies."""

from functools import lru_cache

from app.config import get_settings
from app.llm.client import LLMClient
from app.llm.openai_client import OpenAIClient


@lru_cache
def _build_llm_client() -> LLMClient:
    settings = get_settings()
    if settings.llm_provider == "openai":
        return OpenAIClient()
    raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider!r}")


def get_llm_client() -> LLMClient:
    """Provider chosen by config. Overridden with a fake in tests."""
    return _build_llm_client()
