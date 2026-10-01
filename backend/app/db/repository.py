"""Every SQL statement in the application lives here.

Each method runs in its own short transaction: psycopg commits when the `with pool.connection()`
block exits normally and rolls back on an exception.
"""

from collections.abc import Sequence
from pathlib import Path
from typing import Any
from uuid import UUID

from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.config import ConfigError
from app.errors import AppError
from app.ingestion.chunking import Chunk

SCHEMA_FILE = Path(__file__).with_name("schema.sql")
DOCUMENT_COLUMNS = (
    "id, filename, document_type, size_bytes, status, error_message, chunk_count,"
    " embedding_model, metadata, created_at, updated_at"
)
IN_PROGRESS = ("uploaded", "extracting", "chunking", "embedding", "indexing")

Row = dict[str, Any]


def to_vector_literal(values: Sequence[float]) -> str:
    """pgvector's text input format, e.g. '[0.1,0.2]'; passed as a bound parameter."""
    return "[" + ",".join(str(float(v)) for v in values) + "]"


class Repository:
    def __init__(self, pool: ConnectionPool) -> None:
        self.pool = pool

    @classmethod
    def connect(cls, database_url: str, timeout: float = 10) -> "Repository":
        """Open the pool and wait for a first connection; raises PoolTimeout if unreachable."""
        pool = ConnectionPool(
            database_url,
            min_size=1,
            max_size=10,
            timeout=timeout,
            kwargs={"row_factory": dict_row, "connect_timeout": 5},
            open=False,
        )
        pool.open(wait=True, timeout=timeout)
        return cls(pool)

    def close(self) -> None:
        self.pool.close()

    def init_schema(self, embedding_dimension: int) -> None:
        """Create missing tables; refuse to run if the stored vector size differs from config."""
        ddl = SCHEMA_FILE.read_text(encoding="utf-8").replace(
            "{{EMBEDDING_DIMENSION}}", str(int(embedding_dimension))
        )
        with self.pool.connection() as conn:
            conn.execute(ddl)
            row = conn.execute(
                "SELECT format_type(atttypid, atttypmod) AS column_type FROM pg_attribute"
                " WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'"
            ).fetchone()
        expected = f"vector({embedding_dimension})"
        if row is None or row["column_type"] != expected:
            found = row["column_type"] if row else "missing"
            raise ConfigError(
                f"EMBEDDING_DIMENSION is {embedding_dimension} but the database stores {found}. "
                "Changing the dimension means re-indexing every document: drop the chunks table "
                "(or the database volume) and upload the documents again."
            )

    def ping(self) -> None:
        with self.pool.connection() as conn:
            conn.execute("SELECT 1")

    # ── Documents ────────────────────────────────────────────────────────────

    def create_document(
        self, *, filename: str, document_type: str, size_bytes: int, sha256: str
    ) -> Row:
        """Insert a queued document. Re-uploading content that previously failed replaces the
        failed record; any other duplicate content is rejected."""
        with self.pool.connection() as conn:
            existing = conn.execute(
                "SELECT id, filename, status FROM documents WHERE content_sha256 = %s FOR UPDATE",
                (sha256,),
            ).fetchone()
            if existing and existing["status"] != "failed":
                raise _duplicate(existing["filename"])
            if existing:
                conn.execute("DELETE FROM documents WHERE id = %s", (existing["id"],))
            try:
                return conn.execute(
                    "INSERT INTO documents (filename, document_type, size_bytes, content_sha256,"
                    " status) VALUES (%s, %s, %s, %s, 'uploaded')"
                    f" RETURNING {DOCUMENT_COLUMNS}",
                    (filename, document_type, size_bytes, sha256),
                ).fetchone()
            except UniqueViolation:  # the same file uploaded twice at the same moment
                raise _duplicate(filename) from None

    def list_documents(self) -> list[Row]:
        with self.pool.connection() as conn:
            return conn.execute(
                f"SELECT {DOCUMENT_COLUMNS} FROM documents ORDER BY created_at DESC"
            ).fetchall()

    def get_document(self, document_id: UUID) -> Row | None:
        with self.pool.connection() as conn:
            return conn.execute(
                f"SELECT {DOCUMENT_COLUMNS} FROM documents WHERE id = %s", (document_id,)
            ).fetchone()

    def delete_document(self, document_id: UUID) -> bool:
        with self.pool.connection() as conn:
            deleted = conn.execute("DELETE FROM documents WHERE id = %s", (document_id,)).rowcount
        return deleted > 0

    def set_status(self, document_id: UUID, status: str) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE documents SET status = %s, updated_at = now() WHERE id = %s",
                (status, document_id),
            )

    def mark_failed(self, document_id: UUID, message: str) -> None:
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE documents SET status = 'failed', error_message = %s, updated_at = now()"
                " WHERE id = %s",
                (message, document_id),
            )

    def fail_unfinished_documents(self) -> int:
        """At startup, documents still in progress were interrupted by a restart."""
        with self.pool.connection() as conn:
            return conn.execute(
                "UPDATE documents SET status = 'failed', updated_at = now(),"
                " error_message = 'Processing was interrupted by a server restart."
                " Please upload the file again.'"
                " WHERE status = ANY(%s)",
                (list(IN_PROGRESS),),
            ).rowcount

    def save_chunks(
        self,
        document_id: UUID,
        chunks: Sequence[Chunk],
        embeddings: Sequence[Sequence[float]],
        embedding_model: str,
        metadata: dict[str, int],
    ) -> bool:
        """Store all chunks and mark the document ready in one transaction, so a document is
        never searchable half-indexed. Returns False if it was deleted while processing."""
        with self.pool.connection() as conn:
            updated = conn.execute(
                "UPDATE documents SET status = 'ready', chunk_count = %s, embedding_model = %s,"
                " metadata = %s, error_message = NULL, updated_at = now()"
                " WHERE id = %s RETURNING id",
                (len(chunks), embedding_model, Jsonb(metadata), document_id),
            ).fetchone()
            if updated is None:
                return False
            with conn.cursor() as cursor:
                cursor.executemany(
                    "INSERT INTO chunks (document_id, chunk_index, content, metadata, embedding)"
                    " VALUES (%s, %s, %s, %s, %s::vector)",
                    [
                        (
                            document_id,
                            index,
                            chunk.text,
                            Jsonb(chunk.metadata),
                            to_vector_literal(v),
                        )
                        for index, (chunk, v) in enumerate(zip(chunks, embeddings, strict=True))
                    ],
                )
        return True

    # ── Retrieval & statistics ───────────────────────────────────────────────
    # Only fully indexed documents embedded by the current model are ever searched:
    # vectors from different embedding models live in different spaces.

    def search_chunks(self, vector: Sequence[float], embedding_model: str, limit: int) -> list[Row]:
        """Exact cosine search (no ANN index): every chunk is scored, so recall is perfect."""
        with self.pool.connection() as conn:
            return conn.execute(
                "SELECT c.id AS chunk_id, c.document_id, d.filename AS document_name, c.content,"
                " c.metadata, 1 - (c.embedding <=> %(vector)s::vector) AS similarity"
                " FROM chunks c JOIN documents d ON d.id = c.document_id"
                " WHERE d.status = 'ready' AND d.embedding_model = %(model)s"
                " ORDER BY c.embedding <=> %(vector)s::vector"
                " LIMIT %(limit)s",
                {"vector": to_vector_literal(vector), "model": embedding_model, "limit": limit},
            ).fetchall()

    def has_searchable_documents(self, embedding_model: str) -> bool:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT EXISTS (SELECT 1 FROM documents WHERE status = 'ready'"
                " AND embedding_model = %s AND chunk_count > 0) AS found",
                (embedding_model,),
            ).fetchone()
        return bool(row["found"])


def _duplicate(filename: str) -> AppError:
    return AppError(
        "DUPLICATE_DOCUMENT",
        f'This content is already in the knowledge base as "{filename}".',
        409,
    )
