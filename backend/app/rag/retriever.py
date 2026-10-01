"""Question → embedding → pgvector search → only the chunks that clear the similarity threshold."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.db.repository import Repository
from app.embeddings.provider import EmbeddingProvider


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: UUID
    document_id: UUID
    document_name: str
    content: str
    metadata: dict[str, Any]
    similarity: float


@dataclass(frozen=True)
class Retrieval:
    chunks: list[RetrievedChunk]  # best first, all at or above the threshold
    best_similarity: float | None  # best score seen, even if below the threshold (for logs)


def retrieve(
    question: str,
    *,
    repo: Repository,
    embedder: EmbeddingProvider,
    top_k: int,
    min_similarity: float,
) -> Retrieval:
    vector = embedder.embed_query(question)
    rows = repo.search_chunks(vector, embedder.model_id, top_k)
    candidates = [RetrievedChunk(**row) for row in rows]
    return Retrieval(
        chunks=[c for c in candidates if c.similarity >= min_similarity],
        best_similarity=candidates[0].similarity if candidates else None,
    )


def location_label(metadata: dict[str, Any]) -> str | None:
    """Human-readable source location, built only from metadata the parser actually recorded."""
    labels = {
        "page": "Page {}",
        "section": "Section: {}",
        "row": "Row {}",
        "rows": "Rows {}",
        "record": "Record {}",
        "records": "Records {}",
    }
    for key, template in labels.items():
        if key in metadata:
            return template.format(metadata[key])
    return None
