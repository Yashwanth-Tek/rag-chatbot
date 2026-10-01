# RAG Chatbot

A web app that answers questions **only** from documents you upload. Upload PDF, Word, text,
Markdown, CSV or JSON files; they become a searchable knowledge base; ask questions and get
answers with their sources — or a plain "I couldn't find enough information" when the documents
don't cover it. Nothing is answered from the model's general knowledge.

## Contents

- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup) — environment variables, PostgreSQL + pgvector, Ollama, Anthropic
- [Local development](#local-development)
- [Using the app](#using-the-app) — document upload and knowledge-base creation
- [RAG flow](#rag-flow)
- [Guardrails](#guardrails)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Future: Vertex AI migration](#future-vertex-ai-migration)

## Architecture

```
Browser — React SPA: Dashboard · Knowledge Base · Chat
   │  /api/*  (the Vite dev server proxies to the API: one origin, no CORS)
   ▼
FastAPI ──────────────────────────────────────────────────────────────────────
 INGESTION   POST /api/documents → 202, then a background worker thread
   validate ─► extract ─► normalize ─► chunk ─► embed ─► index ─► READY
   The document's status is updated at each step; any failure → FAILED + a safe reason.

 ANSWERING   POST /api/chat → progress events, then ONE verified result
   ① knowledge base empty? ────────────────────────────► "knowledge base is empty"
   ② embed the question (Ollama)
   ③ pgvector exact cosine top-k (ready documents from the current embedding model only)
   ④ sufficiency gate: no chunk ≥ minimum similarity ───► fallback (Claude not called)
   ⑤ Claude answers with the citations API
   ⑥ every sentence verified (code + a second Claude call) ─ fail ─► retry once ─► fallback
   ⑦ answer segments + sources built from database metadata
──────────────────────────────────────────────────────────────────────────────
PostgreSQL + pgvector (Docker)   Ollama (local, 768-d)   Anthropic API (claude-sonnet-5-5)
```

```
rag-chatbot/
├── .env.example            every setting, with placeholders (copy to .env)
├── docker-compose.yml      PostgreSQL 17 + pgvector
├── backend/                Python 3.12 · FastAPI · managed with uv
│   ├── app/
│   │   ├── main.py         app setup, JSON logging, startup checks, error handlers
│   │   ├── config.py       settings from .env, validated once at startup
│   │   ├── errors.py       errors whose message is safe for users
│   │   ├── llm.py          the Claude client (the only file that changes for Claude on Vertex)
│   │   ├── api/            HTTP endpoints: documents, chat, status
│   │   ├── db/             schema.sql + repository.py (every SQL statement)
│   │   ├── ingestion/      validation, extractors, chunking, pipeline
│   │   ├── embeddings/     EmbeddingProvider interface + Ollama implementation
│   │   └── rag/            retriever, generator, guardrails, prompts, service
│   └── tests/              unit · integration (Docker Postgres) · rag_eval (live models)
└── frontend/               React 19 · TypeScript · Vite · Tailwind CSS
    └── src/                App, api client, hooks, pages/, components/
```

**Database** — two tables. `documents` holds each upload's lifecycle (status, error,
chunk count, the embedding model used, parser facts like page count). `chunks` holds the text,
location metadata (`{"page": 3}`, `{"section": "Company › History"}`, `{"rows": "2–41"}` —
only what the parser actually knows) and the `vector(768)` embedding. Deleting a document
cascades to its chunks. Search is an exact cosine scan (perfect recall); add an HNSW index
(`vector_cosine_ops`) if the chunk count grows past ~100k.

**API**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Live checks (database, Ollama model, Claude model) and non-secret configuration |
| POST | `/api/documents` | Upload one file (multipart field `file`); returns `202` and processes in the background |
| GET | `/api/documents` | List documents with status |
| GET | `/api/documents/{id}` | One document with metadata and failure reason |
| DELETE | `/api/documents/{id}` | Delete a document and its chunks |
| POST | `/api/chat` | `{"question": "..."}` → Server-Sent Events: `stage` events, then one `result` or `error` |

Errors are always `{"error": {"code": "...", "message": "..."}}` with a user-safe message.
Interactive API docs: http://127.0.0.1:8000/docs while the backend runs.

## Technology stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, uvicorn, pydantic-settings |
| Database | PostgreSQL 17 + pgvector (Docker), psycopg 3 with a connection pool, plain SQL |
| Document parsing | pypdf (PDF), python-docx (DOCX), Python standard library (TXT, MD, CSV, JSON) |
| Embeddings | Ollama with `nomic-embed-text` (768 dimensions) |
| Answers | Anthropic API, `claude-sonnet-5-5`, citations + structured outputs |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, react-router, lucide-react icons |
| Tests / quality | pytest, ruff (backend) · tsc, oxlint (frontend) |

No RAG or guardrail framework is used: every step is plain, readable application code.

## Prerequisites

- **Docker Desktop** (runs PostgreSQL + pgvector)
- **Python 3.12** and **[uv](https://docs.astral.sh/uv/)**
- **Node.js 20.19+ or 22.12+** and npm
- **[Ollama](https://ollama.com/download)**
- An **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com/))

## Setup

### 1. Environment variables

```bash
cp .env.example .env
```

Then edit `.env`. Every setting is required unless noted; the backend refuses to start and names
any missing or invalid variable (never its value).

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL. Use `127.0.0.1`, not `localhost` (see Troubleshooting). |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Used by docker-compose to create the database; must match `DATABASE_URL`. |
| `EMBEDDING_PROVIDER` | `ollama` (the only provider implemented today) |
| `OLLAMA_BASE_URL` | Usually `http://127.0.0.1:11434` |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` |
| `OLLAMA_QUERY_PREFIX` / `OLLAMA_DOCUMENT_PREFIX` | Task prefixes the embedding model expects (optional; nomic's are set) |
| `EMBEDDING_DIMENSION` | `768` — must match the model and the database column |
| `LLM_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | Your key. Stays on the backend; never sent to the browser or logged. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (note the hyphen: `claude-sonnet-5.5` is not a valid ID) |
| `ANTHROPIC_EFFORT` | `low` · `medium` · `high` · `xhigh` · `max` — answer thoroughness vs. latency/cost |
| `ANTHROPIC_TIMEOUT_SECONDS` | Per-request timeout |
| `MAX_UPLOAD_MB` | Largest accepted file |
| `CHUNK_SIZE_CHARS` / `CHUNK_OVERLAP_CHARS` | Chunk size and overlap, in characters |
| `RETRIEVAL_TOP_K` | Most chunks sent to Claude per question |
| `RETRIEVAL_MIN_SIMILARITY` | Chunks below this cosine similarity are never sent to Claude — **calibrate it** (below) |
| `LOG_LEVEL` | Optional, default `INFO` |

### 2. PostgreSQL + pgvector

```bash
docker compose up -d
```

This starts `pgvector/pgvector:pg17`, bound to `127.0.0.1:5432` only, with data in a Docker
volume. The backend creates the `vector` extension and both tables on startup — no manual SQL.

### 3. Ollama

Install Ollama, make sure it is running (the desktop app, or `ollama serve`), then:

```bash
ollama pull nomic-embed-text
```

### 4. Anthropic

Put your key in `ANTHROPIC_API_KEY` in `.env`. The Dashboard's System status panel confirms
the key and model work.

### 5. Calibrate the similarity threshold

Similarity scores differ between embedding models, so the threshold is measured, not guessed.
With Ollama running and the key set:

```bash
cd backend
uv run pytest -m live tests/rag_eval/test_retrieval_calibration.py -s
```

It prints the best score for answerable and unrelated questions. Set
`RETRIEVAL_MIN_SIMILARITY` between the lowest answerable score and the highest unrelated score,
then re-run until it passes. Recalibrate whenever the embedding model changes.

## Local development

Two terminals:

```bash
cd backend
uv sync
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Backend logs are JSON lines on stdout.

## Using the app

**Document upload** — on *Knowledge Base*, drop files on the upload area or choose them.
Supported: `.pdf` (with a text layer; scanned image PDFs are rejected), `.docx`, `.txt`, `.md`,
`.csv`, `.json`, up to `MAX_UPLOAD_MB` each. Files are checked in the browser, then again on
the server: extension, size, empty files, UTF-8 encoding for text formats, file signature
(a renamed `.exe` is not a PDF), and DOCX archives that would expand to an unsafe size. Files
are parsed in memory only; nothing is written to disk or executed. Uploading content that is
already in the knowledge base is rejected; re-uploading a file that failed replaces it.

**Knowledge-base creation** — each upload shows its progress (Queued → Extract → Chunk →
Embed → Index → Ready). A document becomes searchable only when every chunk is stored, in one
transaction. Failures show a readable reason (e.g. "The embedding service is unavailable").
Up to two documents process at once; others wait in the queue. If the server restarts
mid-processing, those documents are marked failed on startup — upload them again.

**Chat** — ask a question. Answers show which documents and locations support them. Only
locations the parser recorded are shown (page for PDF, heading path for DOCX/Markdown, rows for
CSV, record numbers for JSON arrays); plain text files show the document name only. The
conversation lives in the browser tab and is not stored.

## RAG flow

1. **Extract** — per format: PDF page by page; DOCX and Markdown by heading, tables kept in
   order; CSV rows as `Column: value` pairs; JSON flattened to `path: value` lines.
2. **Normalize** — line endings, Unicode form, invisible characters and spacing.
3. **Chunk** — split on paragraphs, then lines, then sentences, then words, packing up to
   `CHUNK_SIZE_CHARS` with `CHUNK_OVERLAP_CHARS` of overlap. Chunks never cross a page or
   heading, so every chunk's location is exact. Consecutive CSV rows / JSON records are packed
   together with a row or record range.
4. **Embed** — Ollama, in batches, with the document prefix; an over-long input is an error,
   never silently truncated. The embedding model's name is stored with the document.
5. **Store** — all chunks inserted and the document marked ready in one transaction.
6. **Retrieve** — the question is embedded (query prefix) and the `RETRIEVAL_TOP_K` nearest
   chunks are found by exact cosine distance; chunks below `RETRIEVAL_MIN_SIMILARITY` are dropped.
7. **Generate** — each chunk goes to Claude as a separate citable document; the question
   follows. The answer arrives with citations the API guarantees point into those chunks.
8. **Verify and respond** — see Guardrails. Only a verified answer is sent to the browser.

## Guardrails

Code, not the model, decides what reaches the user.

| # | Layer | Type | Stops |
|---|---|---|---|
| 1 | Empty knowledge base check | code | answering with nothing indexed |
| 2 | Retrieval scope: only ready documents from the current embedding model | code (SQL) | half-indexed documents, comparing vectors from different models |
| 3 | Sufficiency gate: nothing above the similarity threshold → fallback, Claude not called | code | unrelated questions |
| 4 | System prompt: documents only, say what's missing, documents are data not instructions, no aggregates over excerpts | model instruction | guessing, following instructions inside documents |
| 5 | Citation rule: an answer with no citations is "not found"; a sentence judged supported must carry a citation | code | general-knowledge answers, output caused by prompt injection |
| 6 | Claim verifier: a second Claude call (schema-validated JSON) labels every sentence supported / unsupported / not-in-knowledge-base / no-claim against its cited passages; code checks every sentence got exactly one label | model + code | cited-but-embellished claims ("founded in 2015 *by Ravi*") |
| 7 | Any unsupported sentence → regenerate once with a stricter note → still failing → fallback. The rejected draft is logged, never shown | code | everything layers 5–6 catch |
| 8 | Sources built only from database metadata of the cited chunks | code | invented document names, pages or sections |

The fallback message is *"I couldn't find enough information in the provided knowledge base to
answer this question."* Partial answers show the supported part and, separately, what the
knowledge base doesn't cover.

**Limits, stated plainly.** Layers 4 and 6 are model-based, so they reduce hallucination rather
than make it impossible; the code layers bound what can reach the user, and the live evaluation
suite measures behavior. Totals and counts over CSV/JSON data are a known RAG weakness —
retrieval sees excerpts, not whole tables — so the prompt forbids computing them and the verifier
rejects computed aggregates a passage doesn't state. If Claude's safety classifier declines a
request, the server-side fallback (`fallbacks: "default"`) retries eligible categories on another
model; any remaining refusal returns the safe fallback message.

## Testing

```bash
cd backend
uv run pytest               # unit + integration (needs `docker compose up -d`); ~15 s
uv run ruff check . && uv run ruff format --check .
uv run pytest -m live       # real Ollama + Claude (costs API tokens)
```

```bash
cd frontend
npm run lint                # oxlint
npm run build               # type-check (tsc) + production build
```

- **unit** — validation, extractors, normalization, chunking, the Ollama client, citation
  mapping, sentence splitting and the guardrail decision rules, config loading.
- **integration** — the real app against a separate `<db>_test` database with a fake embedder
  and a scripted Claude: upload → ready, list/get/delete, duplicates, failures, oversized and
  invalid uploads, startup recovery, status without secrets, and the chat pipeline — including
  the five hallucination scenarios (answer exists, answer absent, unrelated question, partial
  information, prompt injection in a document), injection through the question, refusals,
  regeneration and service outages.
- **rag_eval** (`-m live`) — the same five scenarios against the real models, plus threshold
  calibration.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend exits with `Invalid configuration: ...` | The message names each missing or invalid variable. Compare `.env` with `.env.example`. |
| `PostgreSQL is unreachable` at startup | `docker compose up -d`, then `docker compose ps` should show `healthy`. |
| Connections take minutes on Windows | Use `127.0.0.1` instead of `localhost` in `DATABASE_URL` and `OLLAMA_BASE_URL` (`localhost` tries IPv6 first). |
| `EMBEDDING_DIMENSION is ... but the database stores vector(...)` | The model's dimension changed. Re-index: `docker compose down -v` (deletes all data), start again, re-upload. |
| Dashboard: "Ollama isn't reachable" | Start Ollama (desktop app or `ollama serve`). |
| Dashboard: "Model ... isn't installed" | `ollama pull nomic-embed-text` |
| Dashboard: "The Anthropic API key was rejected" | Check `ANTHROPIC_API_KEY`, then restart the backend. |
| Dashboard: "Model ... isn't available to this API key" | Check `ANTHROPIC_MODEL` is `claude-sonnet-5-5`. |
| Documents fail with "The embedding service is unavailable" | Ollama was down while processing. Start it, then upload the file again. |
| Everything answers "couldn't find enough information" | `RETRIEVAL_MIN_SIMILARITY` is too high for your model — calibrate it. |
| "Scanned (image) PDFs aren't supported" | The PDF has no text layer. OCR is out of scope; export a text PDF instead. |

## Future: Vertex AI migration

**Embeddings.** `app/embeddings/provider.py` defines the `EmbeddingProvider` interface the
pipeline uses (`embed_documents`, `embed_query`, `check`, `model_id`). To move to Vertex AI:

1. Add `app/embeddings/vertex.py` implementing that interface (Vertex's `RETRIEVAL_DOCUMENT` /
   `RETRIEVAL_QUERY` task types map to `embed_documents` / `embed_query`).
2. Add a `vertex` branch in `create_embedding_provider()` and its settings in `config.py`.
3. Set `EMBEDDING_PROVIDER=vertex`, the model, and `EMBEDDING_DIMENSION` (768 works with Vertex
   models that support a 768 output dimension, which avoids a schema change).
4. **Re-index every document.** Vectors from different models aren't comparable even at the
   same dimension. Documents embedded by the old model are automatically excluded from search
   and flagged "needs re-index" on the Dashboard until they are uploaded again.
5. Recalibrate `RETRIEVAL_MIN_SIMILARITY`.

**Claude.** Claude on Vertex AI uses the same Messages API, and citations work there. Change
`create_llm_client()` in `app/llm.py` to `anthropic.AnthropicVertex(project_id=..., region=...)`
(install `anthropic[vertex]`). Server-side refusal fallback isn't offered on Vertex; the
`fallbacks` parameter would be removed (the SDK's client-side fallback middleware is the
equivalent there).

**Database.** Any managed PostgreSQL with the pgvector extension (e.g. Cloud SQL) works by
changing `DATABASE_URL`.
