import hashlib
import io
import zipfile

import pytest

from app.errors import AppError
from app.ingestion.validation import sanitize_filename, validate_upload
from tests.samples import make_docx, make_pdf

LIMIT = 1024 * 1024


def rejected(filename: str, data: bytes, limit: int = LIMIT) -> AppError:
    with pytest.raises(AppError) as caught:
        validate_upload(filename, data, limit)
    return caught.value


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("report.pdf", "report.pdf"),
        ("../../etc/passwd.txt", "passwd.txt"),
        ("C:\\Users\\me\\notes.md", "notes.md"),
        ("bad\x00name\x07.txt", "badname.txt"),
        ("  spaced.csv  ", "spaced.csv"),
    ],
)
def test_sanitize_filename_keeps_a_safe_base_name(raw, expected):
    assert sanitize_filename(raw) == expected


def test_long_filenames_are_truncated_but_keep_their_extension():
    name = sanitize_filename("a" * 500 + ".json")
    assert len(name) == 200
    assert name.endswith(".json")


def test_empty_filename_is_rejected():
    assert rejected("../", b"hello").code == "INVALID_FILENAME"


@pytest.mark.parametrize("filename", ["virus.exe", "script.sh", "legacy.doc", "noextension"])
def test_unsupported_types_are_rejected(filename):
    error = rejected(filename, b"data")
    assert (error.code, error.status_code) == ("UNSUPPORTED_FILE_TYPE", 415)


def test_empty_file_is_rejected():
    assert rejected("empty.txt", b"").code == "EMPTY_FILE"


def test_oversized_file_is_rejected():
    error = rejected("big.txt", b"x" * (LIMIT + 1))
    assert (error.code, error.status_code) == ("FILE_TOO_LARGE", 413)


def test_text_renamed_as_pdf_is_rejected():
    assert rejected("fake.pdf", b"just some text").code == "FILE_TYPE_MISMATCH"


def test_non_zip_docx_is_rejected():
    assert rejected("fake.docx", b"not a zip archive").code == "FILE_TYPE_MISMATCH"


def test_zip_without_word_document_is_rejected():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "hi")
    assert rejected("fake.docx", buffer.getvalue()).code == "FILE_TYPE_MISMATCH"


def test_docx_that_inflates_far_beyond_the_limit_is_rejected():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", "<w/>")
        archive.writestr("word/bomb.xml", "0" * 50_000)
    error = rejected("bomb.docx", buffer.getvalue(), limit=2_000)
    assert error.code == "UNSAFE_FILE"


def test_docx_text_xml_has_an_absolute_ceiling_even_under_a_large_limit(monkeypatch):
    monkeypatch.setattr("app.ingestion.validation.DOCX_MAX_XML_BYTES", 10_000)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", "<w/>" + " " * 20_000)
    # Well inside a 500 MB upload limit and its 20x expansion allowance, but too much XML.
    error = rejected("big-text.docx", buffer.getvalue(), limit=500 * 1024 * 1024)
    assert error.code == "UNSAFE_FILE"


@pytest.mark.parametrize("data", ["café".encode("latin-1"), "hi".encode("utf-16"), b"a\x00b"])
def test_text_that_is_not_utf8_is_rejected(data):
    assert rejected("notes.txt", data).code == "UNSUPPORTED_ENCODING"


def test_valid_uploads_are_typed_and_hashed():
    pdf = make_pdf(["Hello"])
    upload = validate_upload("Report.PDF", pdf, LIMIT)
    assert upload.document_type == "pdf"
    assert upload.sha256 == hashlib.sha256(pdf).hexdigest()

    assert validate_upload("a.docx", make_docx([("p", "x")]), LIMIT).document_type == "docx"
    assert validate_upload("a.markdown", b"# Title", LIMIT).document_type == "md"
    assert validate_upload("bom.csv", b"\xef\xbb\xbfa,b\n1,2", LIMIT).document_type == "csv"
