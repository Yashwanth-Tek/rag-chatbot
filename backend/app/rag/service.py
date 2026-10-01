"""Question → grounded answer. Yields progress events, then exactly one result event.

① knowledge base empty?        → kb_empty
② retrieve (sufficiency gate)  → not_found without calling Claude
③ generate with citations      → no citations at all → not_found
④ verify every sentence        → rejected → regenerate once → still rejected → not_found
⑤ build segments + sources from database metadata only
"""

import logging
import time
from collections.abc import Iterator
from typing import Any

import anthropic

from app.config import Settings
from app.db.repository import Repository
from app.embeddings.provider import EmbeddingProvider
from app.rag.generator import Draft, generate_answer
from app.rag.guardrails import Assessment, assess, split_sentences, verify
from app.rag.retriever import RetrievedChunk, retrieve

log = logging.getLogger(__name__)

NOT_FOUND_MESSAGE = (
    "I couldn't find enough information in the provided knowledge base to answer this question."
)
EMPTY_KB_MESSAGE = (
    "Your knowledge base has no searchable documents yet. Upload documents on the "
    "Knowledge Base page, then ask again."
)
MAX_ATTEMPTS = 2

Event = dict[str, Any]


def answer_question(
    question: str,
    *,
    repo: Repository,
    embedder: EmbeddingProvider,
    llm: anthropic.Anthropic,
    settings: Settings,
) -> Iterator[Event]:
    started = time.perf_counter()
    trace: dict[str, Any] = {}

    def finish(result: Event) -> Event:
        trace["ms"] = round((time.perf_counter() - started) * 1000)
        log.info("question answered", extra={"status": result["status"], **trace})
        log.debug("question text", extra={"question": question})
        return result

    if not repo.has_searchable_documents(embedder.model_id):
        yield finish(_result("kb_empty", message=EMPTY_KB_MESSAGE))
        return

    yield _stage("retrieving")
    retrieval = retrieve(
        question,
        repo=repo,
        embedder=embedder,
        top_k=settings.retrieval_top_k,
        min_similarity=settings.retrieval_min_similarity,
    )
    trace.update(best_similarity=retrieval.best_similarity, chunks=len(retrieval.chunks))
    if not retrieval.chunks:
        trace["reason"] = "below_similarity_threshold"
        yield finish(_result("not_found", message=NOT_FOUND_MESSAGE))
        return

    for attempt in range(1, MAX_ATTEMPTS + 1):
        trace["attempts"] = attempt
        yield _stage("generating", attempt)
        draft = generate_answer(llm, settings, question, retrieval.chunks, retry=attempt > 1)
        if not draft.usable or not draft.citations:
            # Nothing citable: the model found no answer (or answered from outside the documents).
            trace["reason"] = "no_citations" if draft.usable else "model_declined"
            yield finish(_result("not_found", message=NOT_FOUND_MESSAGE))
            return

        yield _stage("verifying", attempt)
        sentences = split_sentences(draft)
        verdicts = verify(llm, settings, question, sentences, retrieval.chunks) if sentences else []
        assessment = assess(sentences, verdicts)
        trace["verdicts"] = [v for _, v in assessment.sentences]
        if assessment.status != "rejected":
            break
        log.warning("draft rejected by guardrails", extra={"attempt": attempt, **trace})

    if assessment.status in ("rejected", "not_found"):
        trace["reason"] = assessment.status
        yield finish(_result("not_found", message=NOT_FOUND_MESSAGE))
        return
    yield finish(_answer(assessment, draft, retrieval.chunks))


def _answer(assessment: Assessment, draft: Draft, chunks: list[RetrievedChunk]) -> Event:
    source_numbers: dict[int, int] = {}  # chunk index → 1-based source number, in answer order
    segments = []
    for sentence, verdict in assessment.sentences:
        if verdict == "supported":
            numbers = [
                source_numbers.setdefault(i, len(source_numbers) + 1) for i in sentence.chunks
            ]
            segments.append(_segment("supported", sentence.text, numbers, sentence.paragraph_start))
        elif verdict == "not_in_kb":
            segments.append(_segment("not_in_kb", sentence.text, [], sentence.paragraph_start))

    sources = []
    for index, number in source_numbers.items():
        chunk = chunks[index]
        quotes = dict.fromkeys(c.cited_text.strip() for c in draft.citations if c.chunk == index)
        sources.append(
            {
                "id": number,
                "document_id": str(chunk.document_id),
                "document_name": chunk.document_name,
                "location": chunk.metadata,  # only what the parser recorded; may be empty
                "excerpt": " … ".join(q for q in quotes if q),
            }
        )
    return _result(assessment.status, segments=segments, sources=sources)


def _segment(kind: str, text: str, sources: list[int], paragraph_start: bool) -> Event:
    return {"kind": kind, "text": text, "sources": sources, "paragraph_start": paragraph_start}


def _stage(name: str, attempt: int = 1) -> Event:
    return {"event": "stage", "stage": name, "attempt": attempt}


def _result(status: str, *, message: str | None = None, segments=(), sources=()) -> Event:
    return {
        "event": "result",
        "status": status,
        "message": message,
        "segments": list(segments),
        "sources": list(sources),
    }
