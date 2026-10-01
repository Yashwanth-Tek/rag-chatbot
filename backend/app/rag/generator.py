"""Asks Claude for an answer, with each retrieved chunk sent as a citable document.

The citations API guarantees every citation points into a document we sent and returns the exact
cited text, so the model cannot invent a source; guardrails.py decides what the answer may claim.
"""

import logging
from dataclasses import dataclass

import anthropic

from app.config import Settings
from app.llm import FALLBACK_BETA, to_app_error
from app.rag.prompts import ANSWER_SYSTEM_PROMPT, RETRY_NOTE
from app.rag.retriever import RetrievedChunk, location_label

log = logging.getLogger(__name__)

MAX_ANSWER_TOKENS = 16000


@dataclass(frozen=True)
class Citation:
    start: int  # character span in Draft.text that this citation supports
    end: int
    chunk: int  # index into the chunks sent with the question
    cited_text: str  # exact text quoted from that chunk (extracted by the API, not the model)


@dataclass(frozen=True)
class Draft:
    text: str
    citations: list[Citation]
    usable: bool  # False when the model declined or the answer was cut off


def generate_answer(
    client: anthropic.Anthropic,
    settings: Settings,
    question: str,
    chunks: list[RetrievedChunk],
    *,
    retry: bool = False,
) -> Draft:
    content = [_document_block(chunk) for chunk in chunks]
    content.append(
        {"type": "text", "text": f"Question: {question}" + (RETRY_NOTE if retry else "")}
    )
    try:
        response = client.beta.messages.create(
            model=settings.anthropic_model,
            max_tokens=MAX_ANSWER_TOKENS,
            system=ANSWER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_config={"effort": settings.anthropic_effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except anthropic.APIError as exc:
        raise to_app_error(exc) from exc

    if response.stop_reason in ("refusal", "max_tokens"):
        log.warning("answer not usable", extra={"stop_reason": response.stop_reason})
        return Draft("", [], usable=False)

    text = ""
    citations: list[Citation] = []
    for block in response.content:
        if block.type != "text":
            continue
        start = len(text)
        text += block.text
        for citation in block.citations or []:
            if citation.type == "char_location" and 0 <= citation.document_index < len(chunks):
                citations.append(
                    Citation(start, len(text), citation.document_index, citation.cited_text)
                )
    return Draft(text, citations, usable=True)


def _document_block(chunk: RetrievedChunk) -> dict:
    block = {
        "type": "document",
        "source": {"type": "text", "media_type": "text/plain", "data": chunk.content},
        "title": chunk.document_name,
        "citations": {"enabled": True},
    }
    location = location_label(chunk.metadata)
    if location:
        block["context"] = location
    return block
