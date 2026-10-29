from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.client import ClientCreate
from app.schemas.common import (
    Confidence,
    DueDate,
    Evidence,
    FieldState,
    Owner,
    TaskPayload,
)
from app.schemas.meeting import MeetingCreateJson


def test_owner_not_stated_enforces_null():
    """PRD Hard Rule 1: A non-stated owner must be null. TBD/NA/none are forced to None."""
    owner1 = Owner(name="TBD", state=FieldState.NOT_STATED)
    assert owner1.name is None

    owner2 = Owner(name="  n/a  ", state=FieldState.NOT_STATED)
    assert owner2.name is None

    owner3 = Owner(name="Priya", state=FieldState.STATED)
    assert owner3.name == "Priya"
    assert owner3.state == FieldState.STATED


def test_due_date_structure():
    """Test DueDate model preserving verbatim raw_text and calendar resolved_date."""
    due = DueDate(
        raw_text="by end of next week",
        resolved_date=date(2026, 11, 6),
        state=FieldState.STATED,
        note="Resolved from meeting date 28 Oct 2026",
    )
    assert due.raw_text == "by end of next week"
    assert due.resolved_date == date(2026, 11, 6)
    assert due.state == FieldState.STATED


def test_task_payload_validation():
    """Test full Task domain payload with evidence, owner, and confidence."""
    task = TaskPayload(
        id="task-001",
        description="Finalize the MySQL migration and repository architecture",
        owner=Owner(name="Rahul", state=FieldState.STATED),
        due=DueDate(raw_text="Friday", resolved_date=date(2026, 10, 30), state=FieldState.STATED),
        confidence=Confidence.HIGH,
        evidence=[
            Evidence(
                quote="Rahul: I will take ownership of the database migration by Friday.",
                speaker="Rahul",
                line_start=2,
                line_end=2,
            )
        ],
    )
    assert task.id == "task-001"
    assert task.owner.name == "Rahul"
    assert len(task.evidence) == 1
    assert task.evidence[0].line_start == 2


def test_meeting_create_json_validation():
    """Test MeetingCreateJson validates character limits and rejects empty inputs."""
    with pytest.raises(ValidationError):
        MeetingCreateJson(client_id="c1", title="", text="Valid transcript text.")

    with pytest.raises(ValidationError):
        MeetingCreateJson(client_id="c1", title="Title", text="")

    valid = MeetingCreateJson(
        client_id="c1",
        title="Valid Meeting",
        meeting_date=date(2026, 10, 28),
        attendees=["Priya", "Rahul"],
        text="Priya: Meeting notes here.",
    )
    assert valid.title == "Valid Meeting"
    assert len(valid.attendees) == 2


def test_client_create_validation():
    """Test ClientCreate rejects empty names."""
    with pytest.raises(ValidationError):
        ClientCreate(name="   ")

    valid = ClientCreate(name="  Acme Corporation  ")
    assert valid.name == "Acme Corporation"
