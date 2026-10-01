import re

from app.ingestion.chunking import chunk_sections, split_text
from app.ingestion.extractors import Section

SENTENCES = [f"Sentence number {i} talks about topic {i % 7}." for i in range(60)]
LONG_TEXT = " ".join(SENTENCES)


def test_short_text_is_one_chunk():
    assert split_text("Hello world.", size=100, overlap=10) == ["Hello world."]


def test_chunks_respect_the_size_limit():
    chunks = split_text(LONG_TEXT, size=300, overlap=60)
    assert len(chunks) > 5
    assert all(len(chunk) <= 300 for chunk in chunks)


def test_every_sentence_survives_intact_in_some_chunk():
    chunks = split_text(LONG_TEXT, size=300, overlap=60)
    for sentence in SENTENCES:
        assert any(sentence in chunk for chunk in chunks), sentence


def test_consecutive_chunks_overlap():
    chunks = split_text(LONG_TEXT, size=300, overlap=60)
    for previous, current in zip(chunks, chunks[1:], strict=False):
        first_sentence = re.match(r"[^.]*\.", current).group(0)
        assert first_sentence in previous


def test_paragraph_boundaries_are_preferred():
    text = "First paragraph here.\n\nSecond paragraph here."
    assert split_text(text, size=30, overlap=0) == [
        "First paragraph here.",
        "Second paragraph here.",
    ]


def test_unbreakable_text_is_hard_split():
    chunks = split_text("x" * 250, size=100, overlap=0)
    assert [len(c) for c in chunks] == [100, 100, 50]


def test_chunks_never_cross_pages_and_keep_page_metadata():
    pages = [Section(LONG_TEXT, {"page": 1}), Section("Short page two.", {"page": 2})]
    chunks = chunk_sections(pages, size=300, overlap=60)
    assert chunks[-1].text == "Short page two."
    assert chunks[-1].metadata == {"page": 2}
    assert all(c.metadata == {"page": 1} for c in chunks[:-1])


def test_csv_rows_are_packed_into_row_ranges():
    rows = [Section(f"name: person{i} | city: Pune", {"row": i}) for i in range(2, 42)]
    chunks = chunk_sections(rows, size=300, overlap=30)
    assert chunks[0].metadata == {"rows": "2–12"}  # eleven ~26-char rows fit in 300
    assert chunks[0].text.splitlines()[0] == "name: person2 | city: Pune"
    assert all(len(c.text) <= 300 for c in chunks)
    covered = [line for c in chunks for line in c.text.splitlines()]
    assert covered == [r.text for r in rows]


def test_a_lone_record_keeps_its_single_number():
    chunks = chunk_sections([Section("id: 1", {"record": 7}), Section("tail", {})], 100, 10)
    assert [c.metadata for c in chunks] == [{"record": 7}, {}]
