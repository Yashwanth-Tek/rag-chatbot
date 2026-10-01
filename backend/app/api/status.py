"""Dashboard data: live service checks and non-secret configuration.

Document counts come from GET /api/documents, which the UI already polls.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Any

import psycopg
from fastapi import APIRouter, Request

from app.ingestion.validation import SUPPORTED_EXTENSIONS
from app.llm import check_llm

router = APIRouter(prefix="/api", tags=["status"])


@router.get("/status")
def status(request: Request) -> dict[str, Any]:
    state = request.app.state
    settings = state.settings
    try:
        state.repo.ping()
        database_problem = None
    except psycopg.OperationalError:
        database_problem = "The database isn't reachable."

    with ThreadPoolExecutor(max_workers=2) as pool:
        embedding_check = pool.submit(state.embedder.check)
        llm_check = pool.submit(check_llm, state.llm, settings.anthropic_model)
        embedding_problem, llm_problem = embedding_check.result(), llm_check.result()

    return {
        "services": {
            "database": _health(database_problem),
            "embedding": _health(embedding_problem),
            "llm": _health(llm_problem),
        },
        "configuration": {
            "embedding": {
                "provider": settings.embedding_provider,
                "model": settings.ollama_embedding_model,
                "model_id": state.embedder.model_id,
                "dimension": settings.embedding_dimension,
            },
            "llm": {
                "provider": settings.llm_provider,
                "model": settings.anthropic_model,
                "effort": settings.anthropic_effort,
            },
            "retrieval": {
                "top_k": settings.retrieval_top_k,
                "min_similarity": settings.retrieval_min_similarity,
            },
            "chunking": {
                "size_chars": settings.chunk_size_chars,
                "overlap_chars": settings.chunk_overlap_chars,
            },
            "uploads": {
                "max_mb": settings.max_upload_mb,
                "extensions": sorted(SUPPORTED_EXTENSIONS),
            },
        },
    }


def _health(problem: str | None) -> dict[str, Any]:
    return {"ok": problem is None, "detail": problem}
