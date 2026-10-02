from types import SimpleNamespace
from uuid import uuid4

import anthropic
import httpx2
import pytest

from app.errors import AppError
from app.rag.generator import generate_answer
from app.rag.guardrails import split_sentences, verify
from app.rag.retriever import RetrievedChunk
from tests.samples import FakeClaude

SETTINGS = SimpleNamespace(anthropic_model="claude-sonnet-5-5", anthropic_effort="high")


def chunk(content: str, metadata: dict | None = None) -> RetrievedChunk:
    return RetrievedChunk(uuid4(), uuid4(), "company.pdf", content, metadata or {}, 0.9)


CHUNKS = [chunk("The company was founded in 2015.", {"page": 3}), chunk("It has 40 staff.")]


def test_chunks_are_sent_as_citable_documents_with_real_locations_only():
    claude = FakeClaude(answers=[[("Founded in 2015.", 0)]])
    generate_answer(claude, SETTINGS, "When was it founded?", CHUNKS)

    request = claude.answer_requests[0]
    documents = request["messages"][0]["content"][:2]
    assert all(d["citations"] == {"enabled": True} for d in documents)
    assert documents[0]["context"] == "Page 3"
    assert "context" not in documents[1]
    assert request["messages"][0]["content"][2]["text"] == "Question: When was it founded?"
    assert request["fallbacks"] == "default"
    assert request["output_config"] == {"effort": "high"}
    assert "temperature" not in request  # Sonnet 5.5 rejects non-default sampling settings


def test_citations_map_to_character_spans_of_the_answer():
    claude = FakeClaude(answers=[[("Founded in 2015", 0), (" with ", None), ("40 staff", 1)]])
    result = generate_answer(claude, SETTINGS, "q", CHUNKS)
    assert result.text == "Founded in 2015 with 40 staff"
    assert [(c.start, c.end, c.chunk) for c in result.citations] == [(0, 15, 0), (21, 29, 1)]
    assert result.citations[0].cited_text == "The company was founded in 2015."


def test_refusal_gives_an_unusable_draft():
    result = generate_answer(FakeClaude(answers=["refusal"]), SETTINGS, "q", CHUNKS)
    assert not result.usable


def test_retry_adds_the_rejection_note():
    claude = FakeClaude(answers=[[("x", 0)]])
    generate_answer(claude, SETTINGS, "q", CHUNKS, retry=True)
    assert "previous answer" in claude.answer_requests[0]["messages"][0]["content"][-1]["text"]


def test_retry_lists_the_rejected_sentences():
    claude = FakeClaude(answers=[[("x", 0)]])
    generate_answer(claude, SETTINGS, "q", CHUNKS, retry=True, rejected=["It was founded by Ravi."])
    note = claude.answer_requests[0]["messages"][0]["content"][-1]["text"]
    assert "were rejected" in note
    assert "- It was founded by Ravi." in note


def test_first_attempt_has_no_rejection_note():
    claude = FakeClaude(answers=[[("x", 0)]])
    generate_answer(claude, SETTINGS, "q", CHUNKS)
    assert claude.answer_requests[0]["messages"][0]["content"][-1]["text"] == "Question: q"


def test_api_errors_become_safe_app_errors():
    def unreachable(**_request):
        request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
        raise anthropic.APIConnectionError(request=request)

    failing = FakeClaude()
    failing.beta.messages.create = unreachable
    with pytest.raises(AppError) as caught:
        generate_answer(failing, SETTINGS, "q", CHUNKS)
    assert caught.value.code == "LLM_UNAVAILABLE"
    assert "anthropic.com" not in caught.value.message


def test_verifier_sees_only_cited_passages_and_numbered_sentences():
    claude = FakeClaude(
        answers=[[("Founded in 2015.", 0), (" Staff count unknown.", None)]],
        verdicts=[["supported", "not_in_kb"]],
    )
    draft = generate_answer(claude, SETTINGS, "q", CHUNKS)
    verdicts = verify(claude, SETTINGS, "q", split_sentences(draft), CHUNKS)

    assert verdicts == ["supported", "not_in_kb"]
    prompt = claude.verify_requests[0]["messages"][0]["content"]
    assert '<passage id="P1"' in prompt and "P2" not in prompt
    assert "1. [cites: P1] Founded in 2015." in prompt
    assert "2. [cites: nothing] Staff count unknown." in prompt


def test_verifier_output_that_skips_sentences_is_not_trusted():
    claude = FakeClaude(answers=[[("A.", 0), (" B.", 0)]], verdicts=[["supported"]])
    draft = generate_answer(claude, SETTINGS, "q", CHUNKS)
    assert verify(claude, SETTINGS, "q", split_sentences(draft), CHUNKS) is None
