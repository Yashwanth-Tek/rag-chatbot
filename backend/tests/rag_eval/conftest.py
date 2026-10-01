"""Live evaluation against the real Ollama and Claude. Opt in with:  uv run pytest -m live

These cost API tokens and need Ollama running with the configured embedding model.
"""

import pytest

from app.embeddings.provider import create_embedding_provider
from app.llm import check_llm, create_llm_client


@pytest.fixture
def live_client(make_client, settings):
    embedder = create_embedding_provider(settings)
    llm = create_llm_client(settings)
    for problem in (embedder.check(), check_llm(llm, settings.anthropic_model)):
        if problem:
            pytest.fail(f"Live services not ready: {problem}")
    return make_client(embedder=embedder, llm=llm)


@pytest.fixture
def knowledge_base(live_client, upload):
    """Upload documents (name → text) into the live app and return the client."""

    def _load(documents: dict[str, str]):
        for name, text in documents.items():
            document = upload(live_client, name, text.encode(), timeout=180)
            assert document["status"] == "ready", document
        return live_client

    return _load
