import io
import json

import pytest
from pypdf import PdfReader, PdfWriter

from app.errors import AppError
from app.ingestion.extractors import extract, normalize_text
from tests.samples import make_docx, make_pdf


def sections(document_type: str, data: bytes) -> list[tuple[str, dict]]:
    return [(s.text, s.metadata) for s in extract(document_type, data).sections]


def test_pdf_keeps_real_page_numbers_and_skips_blank_pages():
    result = extract("pdf", make_pdf(["Founded in 2015.", "", "Offices in Hyderabad."]))
    assert [(s.text, s.metadata) for s in result.sections] == [
        ("Founded in 2015.", {"page": 1}),
        ("Offices in Hyderabad.", {"page": 3}),
    ]
    assert result.metadata["pages"] == 3


def test_pdf_without_text_layer_is_reported_as_scanned():
    with pytest.raises(AppError, match="Scanned") as caught:
        extract("pdf", make_pdf(["", ""]))
    assert caught.value.code == "NO_TEXT"


def test_password_protected_pdf_is_rejected():
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(make_pdf(["secret"]))))
    writer.encrypt(user_password="pw", algorithm="RC4-128")
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(AppError) as caught:
        extract("pdf", buffer.getvalue())
    assert caught.value.code == "ENCRYPTED_FILE"


def test_corrupted_pdf_gives_a_safe_message():
    with pytest.raises(AppError) as caught:
        extract("pdf", b"%PDF-1.4\n this is not really a pdf")
    assert caught.value.code in {"CORRUPTED_FILE", "NO_TEXT"}
    assert "Traceback" not in caught.value.message


def test_docx_sections_follow_heading_paths_and_keep_tables():
    data = make_docx(
        [
            ("p", "Intro before any heading."),
            ("h1", "Company"),
            ("h2", "History"),
            ("p", "The company was founded in 2015."),
            ("h2", "Offices"),
            ("table", "City|Staff;Hyderabad|120"),
        ]
    )
    assert sections("docx", data) == [
        ("Intro before any heading.", {}),
        ("History\nThe company was founded in 2015.", {"section": "Company › History"}),
        ("Offices\nCity | Staff\nHyderabad | 120", {"section": "Company › Offices"}),
    ]


def test_markdown_headings_ignore_hashes_inside_code_blocks():
    text = "# Guide\nIntro.\n```bash\n# not a heading\n```\n## Setup\nRun it."
    assert sections("md", text.encode()) == [
        ("# Guide\nIntro.\n```bash\n# not a heading\n```", {"section": "Guide"}),
        ("## Setup\nRun it.", {"section": "Guide › Setup"}),
    ]


def test_csv_rows_become_labelled_records_with_spreadsheet_row_numbers():
    data = b"name;city\nAsha;Hyderabad\n;\nRavi;Pune\n"
    result = extract("csv", data)
    assert [(s.text, s.metadata) for s in result.sections] == [
        ("name: Asha | city: Hyderabad", {"row": 2}),
        ("name: Ravi | city: Pune", {"row": 4}),
    ]
    assert result.metadata["rows"] == 3


def test_json_array_becomes_one_section_per_record():
    data = json.dumps([{"name": "Asha", "tags": ["a", "b"]}, {"name": "Ravi", "age": 30}]).encode()
    assert sections("json", data) == [
        ("name: Asha\ntags[0]: a\ntags[1]: b", {"record": 1}),
        ("name: Ravi\nage: 30", {"record": 2}),
    ]


def test_json_object_is_flattened_to_paths():
    data = json.dumps({"company": {"founded": 2015, "city": "Hyderabad"}}).encode()
    assert sections("json", data) == [("company.founded: 2015\ncompany.city: Hyderabad", {})]


def test_invalid_json_reports_the_position():
    with pytest.raises(AppError, match="line 1") as caught:
        extract("json", b'{"a": }')
    assert caught.value.code == "CORRUPTED_FILE"


def test_whitespace_only_file_has_no_text():
    with pytest.raises(AppError) as caught:
        extract("txt", b"  \n\n \t ")
    assert caught.value.code == "NO_TEXT"


def test_normalize_text():
    raw = "Line one  \r\nsoft­hyphen\r\n\r\n\r\n\r\nLast​ line\x07"
    assert normalize_text(raw) == "Line one\nsofthyphen\n\nLast line"
