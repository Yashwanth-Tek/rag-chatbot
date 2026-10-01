import json

import httpx
import pytest

from app.embeddings.ollama import OllamaEmbeddingProvider
from app.errors import AppError


def provider_with(handler, dimension: int = 3) -> OllamaEmbeddingProvider:
    provider = OllamaEmbeddingProvider(
        base_url="http://ollama.test",
        model="nomic-embed-text",
        dimension=dimension,
        query_prefix="search_query: ",
        document_prefix="search_document: ",
    )
    provider._client = httpx.Client(
        base_url="http://ollama.test", transport=httpx.MockTransport(handler)
    )
    return provider


def echo_embeddings(requests: list[dict]):
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        requests.append(body)
        return httpx.Response(200, json={"embeddings": [[0.1, 0.2, 0.3]] * len(body["input"])})

    return handler


def test_documents_and_queries_get_their_task_prefixes():
    requests: list[dict] = []
    provider = provider_with(echo_embeddings(requests))
    provider.embed_documents(["chunk text"])
    provider.embed_query("question?")
    assert requests[0]["input"] == ["search_document: chunk text"]
    assert requests[1]["input"] == ["search_query: question?"]
    assert all(r["truncate"] is False and r["model"] == "nomic-embed-text" for r in requests)


def test_documents_are_sent_in_batches():
    requests: list[dict] = []
    vectors = provider_with(echo_embeddings(requests)).embed_documents([f"t{i}" for i in range(40)])
    assert len(vectors) == 40
    assert [len(r["input"]) for r in requests] == [32, 8]


def test_wrong_vector_size_is_an_error():
    provider = provider_with(lambda r: httpx.Response(200, json={"embeddings": [[0.1, 0.2]]}))
    with pytest.raises(AppError) as caught:
        provider.embed_query("q")
    assert caught.value.code == "EMBEDDING_FAILED"


def test_ollama_down_is_reported_as_unavailable():
    def refuse(request):
        raise httpx.ConnectError("connection refused")

    with pytest.raises(AppError) as caught:
        provider_with(refuse).embed_query("q")
    assert (caught.value.code, caught.value.status_code) == ("EMBEDDING_UNAVAILABLE", 503)
    assert "127.0.0.1" not in caught.value.message


def test_ollama_error_response_is_not_passed_through():
    provider = provider_with(lambda r: httpx.Response(500, text="internal stack trace"))
    with pytest.raises(AppError) as caught:
        provider.embed_documents(["x"])
    assert caught.value.code == "EMBEDDING_FAILED"
    assert "stack trace" not in caught.value.message


@pytest.mark.parametrize(
    ("models", "expected"),
    [
        (["nomic-embed-text:latest"], None),
        (["nomic-embed-text"], None),
        (["llama3:latest"], "isn't installed"),
    ],
)
def test_check_reports_missing_model(models, expected):
    provider = provider_with(
        lambda r: httpx.Response(200, json={"models": [{"name": m} for m in models]})
    )
    problem = provider.check()
    assert problem is None if expected is None else expected in problem


def test_check_reports_unreachable_ollama():
    def refuse(request):
        raise httpx.ConnectError("refused")

    assert "isn't reachable" in provider_with(refuse).check()
