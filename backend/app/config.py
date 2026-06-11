"""Application settings, loaded once from the root .env file.

Centralizes environment-specific values so the rest of the app never touches
os.environ directly — secrets and config stay at a single boundary.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env from this file's location rather than the process working
# directory, so settings load identically regardless of where the app is started.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore"
    )

    llm_provider: str
    llm_model: str
    openai_api_key: str | None = None
    gemini_api_key: str | None = None

    database_url: str
    max_steps: int

    # Voice (optional — only needed for the speech pipeline)
    stt_provider: str = "deepgram"
    tts_provider: str = "elevenlabs"
    deepgram_api_key: str | None = None
    deepgram_model: str = "nova-3"
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str | None = None
    elevenlabs_model: str = "eleven_turbo_v2_5"


@lru_cache
def get_settings() -> Settings:
    return Settings()
