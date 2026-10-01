"""Turns validated file bytes into normalized text sections.

Each section carries only location facts the parser actually knows (page, heading, row, record);
when a format has no such location, the metadata stays empty rather than being guessed.
"""

import csv
import io
import json
import logging
import re
import unicodedata
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field

from docx import Document
from docx.table import Table
from pypdf import PdfReader
from pypdf.errors import DependencyError

from app.errors import AppError

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Section:
    text: str
    metadata: dict[str, str | int] = field(default_factory=dict)


@dataclass(frozen=True)
class Extraction:
    sections: list[Section]
    metadata: dict[str, int]  # document-level facts, e.g. {"pages": 12}


def extract(document_type: str, data: bytes) -> Extraction:
    try:
        raw = _EXTRACTORS[document_type](data)
    except AppError:
        raise
    except Exception as exc:
        log.warning(
            "extraction failed", extra={"document_type": document_type, "error": repr(exc)[:300]}
        )
        raise AppError(
            "CORRUPTED_FILE", "This file couldn't be read. It may be corrupted or incomplete."
        ) from exc

    sections = []
    for section in raw.sections:
        text = normalize_text(section.text)
        if any(ch.isalnum() for ch in text):
            sections.append(Section(text, section.metadata))
    if not sections:
        message = "This file contains no readable text."
        if document_type == "pdf":
            message = "This PDF has no extractable text. Scanned (image) PDFs aren't supported."
        raise AppError("NO_TEXT", message)
    characters = sum(len(section.text) for section in sections)
    return Extraction(sections, {**raw.metadata, "characters": characters})


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0e-\x1f\x7f­​﻿]")
_HORIZONTAL_SPACE = re.compile(r"[ \t\f\v ]+")
_BLANK_LINES = re.compile(r"\n{3,}")


def normalize_text(text: str) -> str:
    """Unify line endings and Unicode form, drop invisible characters, collapse spacing."""
    text = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))
    text = _CONTROL_CHARS.sub("", text)
    lines = (_HORIZONTAL_SPACE.sub(" ", line).strip() for line in text.split("\n"))
    return _BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()


def _decode(data: bytes) -> str:
    return data.decode("utf-8-sig")  # validation already confirmed UTF-8


def _extract_pdf(data: bytes) -> Extraction:
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            unlocked = bool(reader.decrypt(""))
        except DependencyError:
            unlocked = False
        if not unlocked:
            raise AppError(
                "ENCRYPTED_FILE",
                "This PDF is password-protected. Remove the protection and upload it again.",
            )
    sections = [
        Section(page.extract_text() or "", {"page": number})
        for number, page in enumerate(reader.pages, start=1)
    ]
    return Extraction(sections, {"pages": len(reader.pages)})


_HEADING_STYLE = re.compile(r"Heading ([1-9])")


def _extract_docx(data: bytes) -> Extraction:
    """One section per heading, labelled with its heading path; tables stay in document order."""
    document = Document(io.BytesIO(data))
    builder = _SectionBuilder()
    for block in document.iter_inner_content():
        if isinstance(block, Table):
            for row in block.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                builder.add_line(" | ".join(cells))
            continue
        text = block.text.strip()
        style = block.style.name if block.style is not None else ""
        match = _HEADING_STYLE.fullmatch(style)
        level = int(match.group(1)) if match else (1 if style == "Title" else 0)
        if level and text:
            builder.start_heading(level, text)
        else:
            builder.add_line(text)
    return Extraction(builder.finish(), {})


_MD_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_MD_FENCE = re.compile(r"^\s*(```|~~~)")


def _extract_markdown(data: bytes) -> Extraction:
    builder = _SectionBuilder()
    in_code_block = False
    for line in _decode(data).splitlines():
        if _MD_FENCE.match(line):
            in_code_block = not in_code_block
        match = None if in_code_block else _MD_HEADING.match(line)
        if match:
            builder.start_heading(len(match.group(1)), match.group(2), line)
        else:
            builder.add_line(line)
    return Extraction(builder.finish(), {})


def _extract_text(data: bytes) -> Extraction:
    return Extraction([Section(_decode(data))], {})


def _extract_csv(data: bytes) -> Extraction:
    """One section per row, written as `Column: value` pairs so every chunk is self-describing."""
    text = _decode(data)
    try:
        dialect: type[csv.Dialect] = csv.Sniffer().sniff(text[:10_000], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    header = next(reader, [])
    columns = [name.strip() or f"Column {i}" for i, name in enumerate(header, start=1)]
    sections = []
    data_rows = 0
    # Row numbers match a spreadsheet: the header is row 1, the first record is row 2.
    for row_number, row in enumerate(reader, start=2):
        data_rows += 1
        pairs = [
            f"{columns[i] if i < len(columns) else f'Column {i + 1}'}: {value.strip()}"
            for i, value in enumerate(row)
            if value.strip()
        ]
        if pairs:
            sections.append(Section(" | ".join(pairs), {"row": row_number}))
    return Extraction(sections, {"rows": data_rows, "columns": len(columns)})


def _extract_json(data: bytes) -> Extraction:
    """Flatten to `path: value` lines; a top-level array becomes one section per record."""
    try:
        value = json.loads(_decode(data))
    except json.JSONDecodeError as exc:
        raise AppError(
            "CORRUPTED_FILE", f"This isn't valid JSON (line {exc.lineno}, column {exc.colno})."
        ) from exc
    if isinstance(value, list):
        sections = [
            Section("\n".join(_flatten_json(item, "")), {"record": number})
            for number, item in enumerate(value, start=1)
        ]
        return Extraction(sections, {"records": len(value)})
    return Extraction([Section("\n".join(_flatten_json(value, "")))], {})


def _flatten_json(value: object, path: str) -> Iterator[str]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield from _flatten_json(child, f"{path}.{key}" if path else str(key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from _flatten_json(child, f"{path}[{index}]")
    else:
        rendered = value if isinstance(value, str) else json.dumps(value)
        yield f"{path}: {rendered}" if path else str(rendered)


class _SectionBuilder:
    """Collects lines into sections that start at each heading and remember the heading path.

    A heading followed directly by a sub-heading produces no section of its own: its title is
    already part of the sub-section's heading path.
    """

    def __init__(self) -> None:
        self._sections: list[Section] = []
        self._lines: list[str] = []
        self._has_body = False
        self._headings: list[str] = []

    def start_heading(self, level: int, title: str, line: str | None = None) -> None:
        self._flush()
        self._headings[level - 1 :] = [title.strip()]
        self._lines.append(line if line is not None else title)

    def add_line(self, line: str) -> None:
        self._lines.append(line)
        self._has_body = self._has_body or bool(line.strip())

    def finish(self) -> list[Section]:
        self._flush()
        return self._sections

    def _flush(self) -> None:
        if self._has_body:
            metadata = {"section": " › ".join(self._headings)} if self._headings else {}
            self._sections.append(Section("\n".join(self._lines), metadata))
        self._lines = []
        self._has_body = False


_EXTRACTORS: dict[str, Callable[[bytes], Extraction]] = {
    "pdf": _extract_pdf,
    "docx": _extract_docx,
    "md": _extract_markdown,
    "txt": _extract_text,
    "csv": _extract_csv,
    "json": _extract_json,
}
