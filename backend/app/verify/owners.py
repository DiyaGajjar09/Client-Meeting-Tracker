from app.schemas.common import Confidence, FieldState, Owner

FORBIDDEN_OWNER_STRINGS = {
    "we",
    "the team",
    "team",
    "someone",
    "everyone",
    "anybody",
    "nobody",
    "tbd",
    "n/a",
    "na",
    "unknown",
    "none",
    "not stated",
    "unassigned",
    "all",
    "us",
    "group",
    "leadership",
    "devs",
    "engineers",
}


def sanitize_owner(owner: Owner | None) -> Owner:
    """Enforce PRD Hard Rule 1: A non-stated owner must be null."""
    if not owner or not owner.name:
        return Owner(name=None, state=FieldState.NOT_STATED, note=owner.note if owner else None)

    cleaned = owner.name.strip()
    if cleaned.lower() in FORBIDDEN_OWNER_STRINGS:
        return Owner(
            name=None,
            state=FieldState.NOT_STATED,
            note=f"Generic reference '{cleaned}' converted to not_stated",
        )

    # If owner was marked not_stated, name must be None
    if owner.state == FieldState.NOT_STATED:
        return Owner(name=None, state=FieldState.NOT_STATED, note=owner.note)

    return Owner(name=cleaned, state=owner.state, note=owner.note)


def verify_owner(
    owner: Owner,
    transcript_text: str,
    attendees: list[str] | None = None,
) -> tuple[Owner, Confidence, list[str]]:
    """Verify owner name against attendee list and transcript text.

    Returns:
    - sanitized owner
    - confidence rating
    - clarification warnings (e.g. unknown person or ambiguous ownership)
    """
    sanitized = sanitize_owner(owner)
    warnings: list[str] = []

    if sanitized.state == FieldState.NOT_STATED or not sanitized.name:
        return sanitized, Confidence.MEDIUM, warnings

    target_name = sanitized.name.lower()
    lower_transcript = transcript_text.lower()
    known_attendees = [a.strip().lower() for a in (attendees or []) if a.strip()]

    # Check presence in attendees or transcript
    found_in_attendees = any(target_name in att or att in target_name for att in known_attendees)
    found_in_text = target_name in lower_transcript

    if not found_in_attendees and not found_in_text:
        warnings.append(
            f"Assigned owner '{sanitized.name}' not found in attendee list or transcript text"
        )
        return sanitized, Confidence.LOW, warnings

    if sanitized.state == FieldState.IMPLIED:
        return sanitized, Confidence.MEDIUM, warnings

    return sanitized, Confidence.HIGH, warnings

