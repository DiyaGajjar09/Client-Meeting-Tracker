import re
from datetime import date, timedelta

from app.schemas.common import Confidence, DueDate, FieldState

VAGUE_DATE_PATTERNS = [
    r"\bsoon\b",
    r"\basap\b",
    r"\bas soon as possible\b",
    r"\blater\b",
    r"\beventually\b",
    r"\bin the future\b",
    r"\bsometime\b",
    r"\bdown the road\b",
    r"\btbd\b",
    r"\bunknown\b",
]

WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def resolve_relative_date(
    raw_wording: str | None, meeting_date: date | None
) -> tuple[date | None, FieldState]:
    """Deterministically resolve relative deadline wording against the meeting date.

    PRD Rules:
    - If meeting_date is None: preserve raw_wording, resolved_date = None.
    - If vague ('soon', 'asap'): resolved_date = None, state = not_stated.
    - 'next Friday': Friday of the following week.
    - 'Friday': Friday of the current meeting week.
    - 'tomorrow': meeting_date + 1 day.
    """
    if not raw_wording:
        return None, FieldState.NOT_STATED

    clean = raw_wording.strip().lower()

    # Check for vague wording
    for pattern in VAGUE_DATE_PATTERNS:
        if re.search(pattern, clean):
            return None, FieldState.NOT_STATED

    # Check explicit ISO format (YYYY-MM-DD)
    iso_match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", clean)
    if iso_match:
        try:
            return date.fromisoformat(iso_match.group(0)), FieldState.STATED
        except ValueError:
            pass

    # If meeting_date is not known, we cannot calculate relative dates deterministically
    if not meeting_date:
        return None, FieldState.NOT_STATED

    # Tomorrow
    if "tomorrow" in clean:
        return meeting_date + timedelta(days=1), FieldState.STATED

    # In X weeks / in X days
    weeks_match = re.search(r"in\s+(\d+|one|two|three|four)\s+week", clean)
    if weeks_match:
        num_str = weeks_match.group(1)
        word_to_num = {"one": 1, "two": 2, "three": 3, "four": 4}
        n_weeks = word_to_num.get(num_str, int(num_str) if num_str.isdigit() else 1)
        return meeting_date + timedelta(weeks=n_weeks), FieldState.STATED

    # End of week / EOW
    if "end of week" in clean or "eow" in clean:
        days_until_friday = (4 - meeting_date.weekday()) % 7
        return meeting_date + timedelta(days=days_until_friday), FieldState.STATED

    # Next <Weekday> vs <Weekday>
    for day_name, day_idx in WEEKDAY_MAP.items():
        if day_name in clean:
            current_weekday = meeting_date.weekday()
            is_next = "next" in clean

            if is_next:
                # PRD Convention: 'next Friday' means the Friday of the FOLLOWING week
                days_ahead = (day_idx - current_weekday) % 7
                if days_ahead == 0:
                    days_ahead = 7
                return meeting_date + timedelta(days=days_ahead + 7), FieldState.STATED
            else:
                # Simple '<Weekday>' means the upcoming occurrence within this week cycle
                days_ahead = (day_idx - current_weekday) % 7
                return meeting_date + timedelta(days=days_ahead), FieldState.STATED

    return None, FieldState.NOT_STATED


def verify_due_date(
    due: DueDate,
    meeting_date: date | None = None,
) -> tuple[DueDate, Confidence, list[str]]:
    """Validate and normalize due date resolution in deterministic code.

    Enforces that resolved dates must be grounded in raw wording and meeting date.
    """
    warnings: list[str] = []

    if due.state == FieldState.NOT_STATED and not due.raw_text:
        return (
            DueDate(raw_text=None, resolved_date=None, state=FieldState.NOT_STATED, note=due.note),
            Confidence.HIGH,
            warnings,
        )

    resolved, state = resolve_relative_date(due.raw_text, meeting_date)

    # If meeting date is not provided, calendar date cannot be grounded
    if not meeting_date and due.raw_text:
        warnings.append(
            f"Preserved '{due.raw_text}' but calendar date was not resolved because meeting date is unknown"
        )
        return (
            DueDate(
                raw_text=due.raw_text,
                resolved_date=None,
                state=FieldState.NOT_STATED,
                note=due.note or "Meeting date unknown; calendar date not resolved",
            ),
            Confidence.MEDIUM,
            warnings,
        )

    # If LLM guessed a date without meeting_date, reject the guess
    if not meeting_date and due.resolved_date is not None:
        warnings.append(
            f"Preserved '{due.raw_text}' but cleared ungrounded calendar date because meeting date is unknown"
        )
        return (
            DueDate(
                raw_text=due.raw_text,
                resolved_date=None,
                state=FieldState.NOT_STATED,
                note=due.note or "Meeting date unknown; calendar date not resolved",
            ),
            Confidence.MEDIUM,
            warnings,
        )

    final_date = resolved or due.resolved_date
    final_state = state if resolved else due.state

    # Double-check: if state is NOT_STATED, resolved_date must be None
    if final_state == FieldState.NOT_STATED:
        final_date = None

    return (
        DueDate(
            raw_text=due.raw_text,
            resolved_date=final_date,
            state=final_state,
            note=due.note,
        ),
        Confidence.HIGH if final_date else Confidence.MEDIUM,
        warnings,
    )
