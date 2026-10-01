"""Splits sections into overlapping chunks.

Chunks never cross a section boundary, so a chunk's page or heading is always exact. Consecutive
CSV rows / JSON records are packed together (their metadata becomes a range) because a single row
is usually too small to retrieve well on its own.
"""

import re
from dataclasses import dataclass

from app.ingestion.extractors import Section

# Record-style metadata key -> the key used once several records share a chunk.
_RECORD_KEYS = {"row": "rows", "record": "records"}

# Coarsest to finest; each split keeps the separator attached to the preceding piece.
_SPLIT_POINTS = [
    re.compile(r"(?<=\n\n)"),  # paragraphs
    re.compile(r"(?<=\n)"),  # lines
    re.compile(r"(?<=[.!?] )"),  # sentences
    re.compile(r"(?<= )"),  # words
]


@dataclass(frozen=True)
class Chunk:
    text: str
    metadata: dict[str, str | int]


def chunk_sections(sections: list[Section], size: int, overlap: int) -> list[Chunk]:
    return [
        Chunk(text, section.metadata)
        for section in _merge_records(sections, size)
        for text in split_text(section.text, size, overlap)
    ]


def split_text(text: str, size: int, overlap: int) -> list[str]:
    """Pack the largest natural pieces into chunks of at most `size` characters.

    Each new chunk repeats up to `overlap` characters of whole pieces from the end of the previous
    one, so a sentence cut at a boundary still appears intact in one of the two chunks.
    """
    chunks: list[str] = []
    current: list[str] = []
    length = 0
    for piece in _split_to_fit(text, size, level=0):
        if current and length + len(piece) > size:
            chunks.append("".join(current))
            current, length = _tail(current, overlap)
            while current and length + len(piece) > size:
                length -= len(current.pop(0))
        current.append(piece)
        length += len(piece)
    if current:
        chunks.append("".join(current))
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def _split_to_fit(text: str, size: int, level: int) -> list[str]:
    if len(text) <= size:
        return [text]
    if level == len(_SPLIT_POINTS):
        return [text[i : i + size] for i in range(0, len(text), size)]
    parts = [part for part in _SPLIT_POINTS[level].split(text) if part]
    if len(parts) == 1:
        return _split_to_fit(text, size, level + 1)
    return [piece for part in parts for piece in _split_to_fit(part, size, level + 1)]


def _tail(pieces: list[str], overlap: int) -> tuple[list[str], int]:
    tail: list[str] = []
    length = 0
    for piece in reversed(pieces):
        if length + len(piece) > overlap:
            break
        tail.insert(0, piece)
        length += len(piece)
    return tail, length


def _record_key(section: Section) -> str | None:
    return next((key for key in _RECORD_KEYS if key in section.metadata), None)


def _merge_records(sections: list[Section], size: int) -> list[Section]:
    merged: list[Section] = []
    group: list[Section] = []

    def close_group() -> None:
        if not group:
            return
        key = _record_key(group[0])
        assert key is not None
        first, last = group[0].metadata[key], group[-1].metadata[key]
        metadata = {key: first} if first == last else {_RECORD_KEYS[key]: f"{first}–{last}"}
        merged.append(Section("\n".join(section.text for section in group), metadata))
        group.clear()

    for section in sections:
        key = _record_key(section)
        if group:
            grown = sum(len(s.text) + 1 for s in group) + len(section.text)
            if key != _record_key(group[0]) or grown > size:
                close_group()
        if key is None:
            merged.append(section)
        else:
            group.append(section)
    close_group()
    return merged
