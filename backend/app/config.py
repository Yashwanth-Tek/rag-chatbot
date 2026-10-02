"""Application settings, read once at startup from environment variables and the project .env."""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class ConfigError(Exception):
    """Required settings are missing or invalid. The message never contains setting values."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    database_url: SecretStr

    embedding_provider: Literal["ollama"]
    ollama_base_url: str
    ollama_embedding_model: str
    ollama_query_prefix: str = ""
    ollama_document_prefix: str = ""
    embedding_dimension: int = Field(gt=0, le=16000)

    llm_provider: Literal["anthropic"]
    anthropic_api_key: SecretStr
    anthropic_model: str
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"]
    anthropic_timeout_seconds: float = Field(gt=0)

    # Uploads are held in memory while they're validated and parsed; 1 GB is a sanity ceiling.
    max_upload_mb: int = Field(gt=0, le=1024)
    chunk_size_chars: int = Field(ge=200, le=8000)
    chunk_overlap_chars: int = Field(ge=0)

    retrieval_top_k: int = Field(ge=1, le=50)
    retrieval_min_similarity: float = Field(ge=-1, le=1)

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @model_validator(mode="after")
    def _overlap_smaller_than_chunk(self) -> "Settings":
        if self.chunk_overlap_chars >= self.chunk_size_chars:
            raise ValueError("CHUNK_OVERLAP_CHARS must be smaller than CHUNK_SIZE_CHARS")
        return self

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


def load_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        problems = [
            f"{'.'.join(str(part) for part in err['loc']).upper() or 'SETTINGS'}: {err['msg']}"
            for err in exc.errors()
        ]
        # `from None`: pydantic's own message echoes input values, which may be secrets.
        raise ConfigError("Invalid configuration:\n  " + "\n  ".join(problems)) from None
