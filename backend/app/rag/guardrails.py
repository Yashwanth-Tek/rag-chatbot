"""Decides whether a drafted answer may be shown. Code, not the model, has the final say.

1. The draft is split into sentences in code; each sentence is linked to the chunks whose
   citations overlap it.
2. A second Claude call (schema-constrained JSON, no citations) labels every sentence.
3. Code then enforces the rules: every sentence must be labelled, a "supported" sentence must
   carry a citation, and any unsupported sentence rejects the whole draft.
"""

import logging
import re
from dataclasses import dataclass
from typing import Literal

import anthropic
from pydantic import BaseModel

from app.config import Settings
from app.llm import FALLBACK_BETA, to_app_error
from app.rag.generator import Draft
from app.rag.prompts import VERIFIER_SYSTEM_PROMPT
from app.rag.retriever import RetrievedChunk

log = logging.getLogger(__name__)

Verdict = Literal["supported", "unsupported", "not_in_kb", "no_claim"]
MAX_VERIFIER_TOKENS = 8000

_SENTENCE_BREAK = re.compile(r"(?<=[.!?])[ \t]+|\n+")


@dataclass(frozen=True)
class Sentence:
    text: str
    chunks: list[int]  # indices of chunks cited anywhere inside this sentence
    paragraph_start: bool  # preceded by a line break in the draft


@dataclass(frozen=True)
class Assessment:
    status: Literal["answered", "partial", "not_found", "rejected"]
    sentences: list[tuple[Sentence, Verdict]]


class _SentenceVerdict(BaseModel):
    sentence: int
    verdict: Verdict
    reason: str


class _Verification(BaseModel):
    verdicts: list[_SentenceVerdict]


def split_sentences(draft: Draft) -> list[Sentence]:
    sentences: list[Sentence] = []
    position = 0
    after_break = True
    breaks = [*_SENTENCE_BREAK.finditer(draft.text), None]
    for match in breaks:
        end = match.start() if match else len(draft.text)
        raw = draft.text[position:end]
        text = raw.strip()
        if any(ch.isalnum() for ch in text):
            start = position + len(raw) - len(raw.lstrip())
            stop = start + len(text)
            cited = sorted({c.chunk for c in draft.citations if c.start < stop and c.end > start})
            sentences.append(Sentence(text, cited, after_break))
        if match:
            after_break = "\n" in match.group(0)
            position = match.end()
    return sentences


def verify(
    client: anthropic.Anthropic,
    settings: Settings,
    question: str,
    sentences: list[Sentence],
    chunks: list[RetrievedChunk],
) -> list[Verdict] | None:
    """One verdict per sentence, or None when the verifier's output can't be used."""
    cited = sorted({index for sentence in sentences for index in sentence.chunks})
    passages = "\n\n".join(
        f'<passage id="P{i + 1}" source="{chunks[i].document_name}">\n{chunks[i].content}\n'
        "</passage>"
        for i in cited
    )
    numbered = "\n".join(
        f"{n}. [cites: {', '.join(f'P{i + 1}' for i in s.chunks) or 'nothing'}] {s.text}"
        for n, s in enumerate(sentences, start=1)
    )
    prompt = (
        f"<question>\n{question}\n</question>\n\n"
        f"<passages>\n{passages or '(no passages cited)'}\n</passages>\n\n"
        f"<answer_sentences>\n{numbered}\n</answer_sentences>"
    )
    try:
        response = client.beta.messages.parse(
            model=settings.anthropic_model,
            max_tokens=MAX_VERIFIER_TOKENS,
            system=VERIFIER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
            output_format=_Verification,
            output_config={"effort": settings.anthropic_effort},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except anthropic.APIError as exc:
        raise to_app_error(exc) from exc

    if response.stop_reason != "end_turn" or response.parsed_output is None:
        log.warning("verifier output unusable", extra={"stop_reason": response.stop_reason})
        return None
    by_number = {v.sentence: v.verdict for v in response.parsed_output.verdicts}
    if set(by_number) != set(range(1, len(sentences) + 1)):
        log.warning("verifier skipped or invented sentences", extra={"returned": len(by_number)})
        return None
    return [by_number[n] for n in range(1, len(sentences) + 1)]


def assess(sentences: list[Sentence], verdicts: list[Verdict] | None) -> Assessment:
    if verdicts is None or len(verdicts) != len(sentences):
        return Assessment("rejected", [])
    # A claim labelled supported but carrying no citation is treated as unsupported.
    checked: list[tuple[Sentence, Verdict]] = [
        (s, "unsupported" if v == "supported" and not s.chunks else v)
        for s, v in zip(sentences, verdicts, strict=True)
    ]
    kinds = {verdict for _, verdict in checked}
    if "unsupported" in kinds:
        return Assessment("rejected", checked)
    if "supported" not in kinds:
        return Assessment("not_found", checked)
    return Assessment("partial" if "not_in_kb" in kinds else "answered", checked)
