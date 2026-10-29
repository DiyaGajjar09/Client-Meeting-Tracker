import pytest

from app.core.exceptions import (
    InvalidInputError,
    PayloadTooLargeError,
    UnsupportedMediaTypeError,
)
from app.ingestion.parsers import parse_transcript_file
from app.ingestion.speakers import process_transcript_lines


def test_parse_txt_file(sample_txt_bytes: bytes):
    """Test parsing a valid .txt transcript file."""
    text, filename = parse_transcript_file("meeting.txt", sample_txt_bytes)
    assert filename == "meeting.txt"
    assert "Priya: We need to finalize" in text
    assert "Rahul: I will take ownership" in text


def test_parse_docx_file(sample_docx_bytes: bytes):
    """Test parsing a valid .docx transcript document."""
    text, filename = parse_transcript_file("sync.docx", sample_docx_bytes)
    assert filename == "sync.docx"
    assert "Sprint Planning Notes" in text
    assert "Priya: Review the client" in text


def test_parse_vtt_file(sample_vtt_bytes: bytes):
    """Test parsing a WebVTT file with cues and timestamp stripping."""
    text, filename = parse_transcript_file("call.vtt", sample_vtt_bytes)
    assert filename == "call.vtt"
    assert "WEBVTT" not in text
    assert "-->" not in text
    assert "Priya: We agreed to ship" in text
    assert "Rahul: I will write the unit tests" in text


def test_parse_srt_file(sample_srt_bytes: bytes):
    """Test parsing an SRT file with index/timestamp stripping."""
    text, filename = parse_transcript_file("recording.srt", sample_srt_bytes)
    assert filename == "recording.srt"
    assert "-->" not in text
    assert "Priya: The client requested Excel" in text


def test_unsupported_extension_rejected():
    """Test that unsupported file formats (.mp3, .exe, .json) raise HTTP 415."""
    with pytest.raises(UnsupportedMediaTypeError) as exc_info:
        parse_transcript_file("audio.mp3", b"dummy audio content")
    assert "unsupported" in str(exc_info.value).lower()

    with pytest.raises(UnsupportedMediaTypeError):
        parse_transcript_file("malicious.exe", b"binary")


def test_empty_file_rejected():
    """Test that zero-byte uploads raise HTTP 422."""
    with pytest.raises(InvalidInputError):
        parse_transcript_file("empty.txt", b"")


def test_oversized_file_rejected():
    """Test that files exceeding 10 MB raise HTTP 413."""
    oversized = b"a" * (10 * 1024 * 1024 + 100)
    with pytest.raises(PayloadTooLargeError):
        parse_transcript_file("massive.txt", oversized)


def test_speaker_normalization():
    """Test normalizing timestamps and extracting line indices."""
    raw = (
        "[00:12:03] Priya: Let us review the architecture.\n"
        "(12:05) Rahul: Everything is prepared.\n"
        "Sarah: What about MySQL?\n"
    )

    clean_text, indexed = process_transcript_lines(raw)
    assert len(indexed) == 3
    assert indexed[0] == (1, "Priya: Let us review the architecture.")
    assert indexed[1] == (2, "Rahul: Everything is prepared.")
    assert indexed[2] == (3, "Sarah: What about MySQL?")
    assert "[00:12:03]" not in clean_text
    assert "(12:05)" not in clean_text
