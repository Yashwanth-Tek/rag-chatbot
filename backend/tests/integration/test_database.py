import psycopg
import pytest

from app.config import ConfigError
from app.db.repository import Repository


def test_schema_has_pgvector_column_with_configured_dimension(repo, settings):
    with repo.pool.connection() as conn:
        row = conn.execute(
            "SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute"
            " WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'"
        ).fetchone()
    assert row["t"] == f"vector({settings.embedding_dimension})"


def test_init_schema_is_idempotent(repo, settings):
    repo.init_schema(settings.embedding_dimension)
    repo.init_schema(settings.embedding_dimension)
    repo.ping()


def test_dimension_mismatch_stops_startup(repo, settings, recreate_schema):
    recreate_schema(repo, 1024)
    with pytest.raises(ConfigError, match="re-indexing"):
        repo.init_schema(settings.embedding_dimension)


def test_unreachable_database_raises_operational_error():
    with pytest.raises(psycopg.OperationalError):
        Repository.connect("postgresql://nobody:nothing@127.0.0.1:1/none", timeout=1)
