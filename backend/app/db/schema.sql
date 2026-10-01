-- Applied at startup; every statement is idempotent.
-- {{EMBEDDING_DIMENSION}} is replaced with the validated EMBEDDING_DIMENSION setting.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        text NOT NULL,
    document_type   text NOT NULL,
    size_bytes      bigint NOT NULL,
    content_sha256  text NOT NULL UNIQUE,
    status          text NOT NULL CHECK (status IN
                    ('uploaded', 'extracting', 'chunking', 'embedding', 'indexing', 'ready', 'failed')),
    error_message   text,
    chunk_count     integer NOT NULL DEFAULT 0,
    embedding_model text,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,
    content     text NOT NULL,
    metadata    jsonb NOT NULL DEFAULT '{}',
    embedding   vector({{EMBEDDING_DIMENSION}}) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);
