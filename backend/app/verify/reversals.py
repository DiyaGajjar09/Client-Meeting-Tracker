import re

from app.schemas.common import Confidence, DecisionPayload, TaskPayload

REVERSAL_PATTERNS = [
    r"\b(cancel|cancelled|canceling|scrap|scrapped|scratch|revert|reversed|reversing)\b",
    r"\b(change(?:d)?\s+(?:our|my)\s+mind)\b",
    r"\b(no\s+longer\s+(?:need|doing|proceeding))\b",
    r"\b(nevermind|never\s+mind)\b",
    r"\b(decided\s+against)\b",
    r"\b(call\s+off|called\s+off)\b",
    r"\b(don't\s+do\s+that|do\s+not\s+do\s+that)\b",
]


def check_transcript_for_cancellation(
    item_description: str,
    evidence_line_end: int | None,
    transcript_lines: list[str],
) -> tuple[bool, str | None]:
    """Check lines subsequent to the item's evidence for reversal or cancellation cues."""
    if not evidence_line_end or evidence_line_end >= len(transcript_lines):
        # Look across full transcript for explicit negation of key phrases
        subsequent_text = "\n".join(transcript_lines)
    else:
        # Check transcript specifically AFTER this item was discussed
        subsequent_text = "\n".join(transcript_lines[evidence_line_end:])

    # Extract keywords from item description (words > 4 chars)
    keywords = [w.lower() for w in re.findall(r"\b[a-zA-Z]{4,}\b", item_description)]

    for line in subsequent_text.splitlines():
        line_lower = line.lower()
        has_reversal_cue = any(re.search(pat, line_lower) for pat in REVERSAL_PATTERNS)
        if has_reversal_cue:
            # Check if any key content word also appears in this reversal line
            matches = [kw for kw in keywords if kw in line_lower]
            if matches or len(keywords) <= 2:
                return True, f"Reversal/cancellation detected in transcript: '{line.strip()}'"

    return False, None


def apply_reversals_and_cancellations(
    tasks: list[TaskPayload],
    decisions: list[DecisionPayload],
    transcript_text: str,
) -> tuple[list[TaskPayload], list[DecisionPayload]]:
    """Scan extracted items and annotate any task or decision that was overturned later in the meeting."""
    transcript_lines = transcript_text.splitlines()

    annotated_tasks: list[TaskPayload] = []
    for task in tasks:
        line_end = task.evidence[0].line_end if task.evidence else None
        is_cancelled, note = check_transcript_for_cancellation(
            task.description, line_end, transcript_lines
        )
        if is_cancelled:
            updated_clarifications = list(task.clarification_needed)
            updated_clarifications.append(f"CANCELLED: {note}")
            # Mark low confidence and add note
            updated_task = task.model_copy(
                update={
                    "confidence": Confidence.LOW,
                    "clarification_needed": updated_clarifications,
                }
            )
            annotated_tasks.append(updated_task)
        else:
            annotated_tasks.append(task)

    annotated_decisions: list[DecisionPayload] = []
    for decision in decisions:
        line_end = decision.evidence[0].line_end if decision.evidence else None
        is_reversed, note = check_transcript_for_cancellation(
            decision.statement, line_end, transcript_lines
        )
        if is_reversed:
            # Flag reversed decision
            updated_statement = f"[REVERSED] {decision.statement} ({note})"
            updated_decision = decision.model_copy(
                update={
                    "statement": updated_statement,
                    "confidence": Confidence.LOW,
                }
            )
            annotated_decisions.append(updated_decision)
        else:
            annotated_decisions.append(decision)

    return annotated_tasks, annotated_decisions

