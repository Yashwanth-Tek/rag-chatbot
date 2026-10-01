import pytest

from app.config import ConfigError, Settings, load_settings

VALID_ENV = {
    "DATABASE_URL": "postgresql://user:pw@localhost:5432/db",
    "EMBEDDING_PROVIDER": "ollama",
    "OLLAMA_BASE_URL": "http://localhost:11434",
    "OLLAMA_EMBEDDING_MODEL": "nomic-embed-text",
    "EMBEDDING_DIMENSION": "768",
    "LLM_PROVIDER": "anthropic",
    "ANTHROPIC_API_KEY": "sk-secret-value",
    "ANTHROPIC_MODEL": "claude-sonnet-5-5",
    "ANTHROPIC_EFFORT": "high",
    "ANTHROPIC_TIMEOUT_SECONDS": "60",
    "MAX_UPLOAD_MB": "20",
    "CHUNK_SIZE_CHARS": "2000",
    "CHUNK_OVERLAP_CHARS": "200",
    "RETRIEVAL_TOP_K": "8",
    "RETRIEVAL_MIN_SIMILARITY": "0.5",
}


@pytest.fixture
def env(monkeypatch):
    """Isolate from the developer's .env and shell; start from a valid environment."""
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    for name in VALID_ENV:
        monkeypatch.delenv(name, raising=False)
    for name, value in VALID_ENV.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


def test_valid_environment_loads(env):
    settings = load_settings()
    assert settings.embedding_dimension == 768
    assert settings.max_upload_bytes == 20 * 1024 * 1024
    assert settings.anthropic_api_key.get_secret_value() == "sk-secret-value"


def test_error_names_every_bad_variable_without_leaking_values(env):
    env.delenv("DATABASE_URL")
    env.setenv("ANTHROPIC_TIMEOUT_SECONDS", "not-a-number")

    with pytest.raises(ConfigError) as caught:
        load_settings()

    message = str(caught.value)
    assert "DATABASE_URL" in message
    assert "ANTHROPIC_TIMEOUT_SECONDS" in message
    assert "not-a-number" not in message
    assert "sk-secret-value" not in message


def test_unsupported_provider_is_rejected(env):
    env.setenv("EMBEDDING_PROVIDER", "vertex")
    with pytest.raises(ConfigError, match="EMBEDDING_PROVIDER"):
        load_settings()


def test_overlap_must_be_smaller_than_chunk_size(env):
    env.setenv("CHUNK_OVERLAP_CHARS", "2000")
    with pytest.raises(ConfigError, match="CHUNK_OVERLAP_CHARS must be smaller"):
        load_settings()


def test_secrets_are_masked_in_repr(env):
    settings = load_settings()
    assert "sk-secret-value" not in repr(settings)
    assert "pw@" not in repr(settings)
