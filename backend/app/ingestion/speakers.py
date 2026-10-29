import re

# Patterns matching timestamps preceding or following speaker names
TIMESTAMP_PREFIX_PATTERN = re.compile(
    r"^\[?\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\]?\s*",
    re.IGNORECASE,
)
TIMESTAMP_PAREN_PATTERN = re.compile(
    r"^\(?\d{1,2}:\d{2}(?::\d{2})?\)?\s*",
    re.IGNORECASE,
)


def normalize_line(line: str) -> str:
    """Clean common transcript prefixes while preserving speaker name and utterance."""
    stripped = line.strip()
    if not stripped:
        return ""

    # Remove leading timestamps like [00:12:34] or (12:34)
    cleaned = TIMESTAMP_PREFIX_PATTERN.sub("", stripped)
    cleaned = TIMESTAMP_PAREN_PATTERN.sub("", cleaned).strip()

    return cleaned


def process_transcript_lines(raw_text: str) -> tuple[str, list[tuple[int, str]]]:
    """Process raw text into normalized text and indexed lines with stable line numbering.

    Returns:
        Tuple of (normalized_text, list_of_indexed_lines)
    """
    raw_lines = raw_text.splitlines()
    indexed_lines: list[tuple[int, str]] = []
    clean_lines: list[str] = []

    line_number = 1
    for raw_line in raw_lines:
        normalized = normalize_line(raw_line)
        if normalized:
            indexed_lines.append((line_number, normalized))
            clean_lines.append(normalized)
            line_number += 1

    normalized_text = "\n".join(clean_lines)
    return normalized_text, indexed_lines
