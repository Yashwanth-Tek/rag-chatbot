from app.rag.generator import Citation, Draft
from app.rag.guardrails import Sentence, assess, split_sentences


def draft(*blocks: tuple[str, int | None]) -> Draft:
    """Build a draft the way the generator does: text blocks, some carrying one citation."""
    text, citations = "", []
    for block_text, chunk in blocks:
        start = len(text)
        text += block_text
        if chunk is not None:
            citations.append(Citation(start, len(text), chunk, "quoted"))
    return Draft(text, citations, usable=True)


def test_sentences_are_linked_to_the_citations_inside_them():
    sentences = split_sentences(
        draft(
            ("The company was founded in 2015", 0),
            (" in ", None),
            ("Hyderabad", 1),
            (". The documents don't name the founder.", None),
        )
    )
    assert [(s.text, s.chunks) for s in sentences] == [
        ("The company was founded in 2015 in Hyderabad.", [0, 1]),
        ("The documents don't name the founder.", []),
    ]


def test_line_breaks_and_bullets_start_new_sentences():
    sentences = split_sentences(draft(("Policies:\n- Leave is 20 days\n- Remote work allowed", 0)))
    assert [(s.text, s.paragraph_start) for s in sentences] == [
        ("Policies:", True),
        ("- Leave is 20 days", True),
        ("- Remote work allowed", True),
    ]


def test_punctuation_only_fragments_are_ignored():
    assert [s.text for s in split_sentences(draft(("Yes.", 0), (" .", None)))] == ["Yes."]


def sentence(text: str, chunks: list[int]) -> Sentence:
    return Sentence(text, chunks, paragraph_start=False)


CITED = sentence("Founded in 2015.", [0])
ABSENT = sentence("The documents don't say who founded it.", [])
FILLER = sentence("Here is what I found:", [])


def test_fully_supported_answer():
    assert assess([FILLER, CITED], ["no_claim", "supported"]).status == "answered"


def test_supported_plus_missing_parts_is_partial():
    assert assess([CITED, ABSENT], ["supported", "not_in_kb"]).status == "partial"


def test_no_supported_sentence_is_not_found():
    assert assess([ABSENT], ["not_in_kb"]).status == "not_found"


def test_any_unsupported_sentence_rejects_the_draft():
    assert assess([CITED, ABSENT], ["supported", "unsupported"]).status == "rejected"


def test_uncited_sentence_cannot_count_as_supported():
    """Code overrides the verifier: a claim with no citation is never accepted."""
    uncited_claim = sentence("The CEO is John Smith.", [])
    result = assess([CITED, uncited_claim], ["supported", "supported"])
    assert result.status == "rejected"
    assert result.sentences[1][1] == "unsupported"


def test_missing_or_mismatched_verdicts_reject_the_draft():
    assert assess([CITED], None).status == "rejected"
    assert assess([CITED, ABSENT], ["supported"]).status == "rejected"
