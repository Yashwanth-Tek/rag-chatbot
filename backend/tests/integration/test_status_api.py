from tests.samples import UnavailableEmbedder


def test_status_reports_services_and_config_without_secrets(make_client, settings):
    status = make_client().get("/api/status").json()

    assert all(service["ok"] for service in status["services"].values())
    assert status["configuration"]["llm"]["model"] == settings.anthropic_model
    assert status["configuration"]["embedding"]["model_id"] == "fake/bag-of-words"
    assert ".pdf" in status["configuration"]["uploads"]["extensions"]
    body = str(status)
    assert settings.anthropic_api_key.get_secret_value() not in body
    assert settings.database_url.get_secret_value() not in body
    assert "postgresql://" not in body


def test_status_shows_a_down_embedding_service(make_client):
    status = make_client(embedder=UnavailableEmbedder()).get("/api/status").json()
    assert status["services"]["embedding"] == {"ok": False, "detail": "Ollama isn't reachable."}
    assert status["services"]["database"]["ok"] is True
