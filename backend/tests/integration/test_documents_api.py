from tests.samples import UnavailableEmbedder, make_pdf


def test_upload_processes_to_ready_with_chunks(make_client, upload, repo):
    client = make_client()
    document = upload(client, "company.pdf", make_pdf(["The company was founded in 2015."]))

    assert document["status"] == "ready"
    assert document["chunk_count"] == 1
    assert document["embedding_model"] == "fake/bag-of-words"
    assert document["metadata"]["pages"] == 1
    with repo.pool.connection() as conn:
        chunk = conn.execute("SELECT content, metadata FROM chunks").fetchone()
    assert chunk == {"content": "The company was founded in 2015.", "metadata": {"page": 1}}


def test_list_get_and_delete(make_client, upload, repo):
    client = make_client()
    document = upload(client, "notes.txt", b"Some notes about the office.")

    assert [d["id"] for d in client.get("/api/documents").json()] == [document["id"]]
    assert client.delete(f"/api/documents/{document['id']}").status_code == 204
    assert client.get(f"/api/documents/{document['id']}").status_code == 404
    with repo.pool.connection() as conn:
        assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 0


def test_duplicate_content_is_rejected(make_client, upload):
    client = make_client()
    upload(client, "a.txt", b"identical content")
    response = client.post("/api/documents", files={"file": ("b.txt", b"identical content")})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DUPLICATE_DOCUMENT"


def test_failed_document_records_a_safe_reason_and_can_be_retried(make_client, upload):
    failing = make_client(embedder=UnavailableEmbedder())
    document = upload(failing, "notes.txt", b"Content to embed.")
    assert document["status"] == "failed"
    assert document["error_message"] == "The embedding service is unavailable."

    working = make_client()
    retried = upload(working, "notes.txt", b"Content to embed.")
    assert retried["status"] == "ready"
    assert len(working.get("/api/documents").json()) == 1


def test_unreadable_document_fails_during_processing(make_client, upload):
    document = upload(make_client(), "empty.pdf", make_pdf([""]))
    assert document["status"] == "failed"
    assert "Scanned" in document["error_message"]


def test_rejected_uploads_return_clean_errors(make_client):
    client = make_client(max_upload_mb=1)

    unsupported = client.post("/api/documents", files={"file": ("run.exe", b"MZ")})
    assert unsupported.status_code == 415

    too_big = client.post("/api/documents", files={"file": ("big.txt", b"x" * (2 * 1024 * 1024))})
    assert too_big.status_code == 413
    assert too_big.json()["error"]["code"] == "FILE_TOO_LARGE"

    no_file = client.post("/api/documents", data={"other": "field"})
    assert no_file.status_code == 400
    assert no_file.json()["error"]["code"] == "INVALID_REQUEST"

    bad_id = client.get("/api/documents/not-a-uuid")
    assert bad_id.status_code == 422
    assert "Traceback" not in bad_id.text


def test_startup_fails_documents_interrupted_mid_processing(make_client, repo):
    document = repo.create_document(
        filename="stuck.txt", document_type="txt", size_bytes=5, sha256="abc"
    )
    repo.set_status(document["id"], "embedding")

    client = make_client()

    stuck = client.get(f"/api/documents/{document['id']}").json()
    assert stuck["status"] == "failed"
    assert "interrupted" in stuck["error_message"]
