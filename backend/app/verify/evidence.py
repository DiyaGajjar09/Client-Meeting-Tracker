import difflib
import re

from app.core.config import settings
from app.schemas.common import Confidence, Evidence


def compute_similarity_ratio(a: str, b: str) -> float:
    """Compute normalized SequenceMatcher ratio between two text fragments."""
    clean_a = re.sub(r"\s+", " ", a.strip().lower())
    clean_b = re.sub(r"\s+", " ", b.strip().lower())
    if not clean_a or not clean_b:
        return 0.0
    return difflib.SequenceMatcher(None, clean_a, clean_b).ratio()


def find_best_quote_match(quote: str, transcript_text: str) -> tuple[float, int | None, int | None]:
    """Search for the best match of quote in transcript and return (ratio, line_start, line_end)."""
    clean_quote = quote.strip(" \t\n\r\"'")
    if not clean_quote:
        return 0.0, None, None

    transcript_lines = transcript_text.splitlines()
    if not transcript_lines:
        return 0.0, None, None

    # 1. Exact substring check across lines
    lower_transcript = transcript_text.lower()
    lower_quote = clean_quote.lower()
    if lower_quote in lower_transcript:
        # Find which line contains it
        for idx, line in enumerate(transcript_lines, start=1):
            if lower_quote in line.lower():
                return 1.0, idx, idx
        # May span adjacent lines
        return 1.0, 1, len(transcript_lines)

    # 2. Line-by-line fuzzy matching
    best_ratio = 0.0
    best_start = None
    best_end = None

    for idx, line in enumerate(transcript_lines, start=1):
        ratio = compute_similarity_ratio(clean_quote, line)
        if ratio > best_ratio:
            best_ratio = ratio
            best_start = idx
            best_end = idx

    # 3. Two-line window fuzzy matching for quotes spanning turns
    for idx in range(len(transcript_lines) - 1):
        window = f"{transcript_lines[idx]} {transcript_lines[idx+1]}"
        ratio = compute_similarity_ratio(clean_quote, window)
        if ratio > best_ratio:
            best_ratio = ratio
            best_start = idx + 1
            best_end = idx + 2

    return best_ratio, best_start, best_end


def verify_evidence_quotes(
    evidence_list: list[Evidence], transcript_text: str
) -> tuple[list[Evidence], Confidence, list[str]]:
    """Validate all evidence quotes against the source transcript.

    Returns:
    - verified evidence list with resolved line numbers
    - confidence level (downgraded to LOW if quote match < threshold)
    - clarification notes or flags if quote not found
    """
    flags: list[str] = []
    threshold = settings.QUOTE_MATCH_MIN_RATIO
    verified_evidence: list[Evidence] = []
    has_low_match = False

    if not evidence_list:
        flags.append("No supporting evidence quote provided")
        return [], Confidence.LOW, flags

    for ev in evidence_list:
        ratio, line_start, line_end = find_best_quote_match(ev.quote, transcript_text)
        updated_ev = Evidence(
            quote=ev.quote,
            speaker=ev.speaker,
            line_start=line_start or ev.line_start,
            line_end=line_end or ev.line_end,
        )
        verified_evidence.append(updated_ev)

        if ratio < threshold:
            has_low_match = True
            flags.append(
                f"Quote '{ev.quote[:35]}...' not verified in transcript (similarity: {ratio:.0%})"
            )

    resulting_confidence = Confidence.LOW if has_low_match else Confidence.HIGH
    return verified_evidence, resulting_confidence, flags
