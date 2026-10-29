from datetime import date
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import EntityNotFoundError
from app.db.models import ClientModel, ItemModel, MeetingModel
from app.repositories.meeting_repository import MeetingRepository
from app.services.clarification_service import ClarificationService
from app.services.meeting_service import MeetingService


def test_clarification_open_items_generates_deterministic_questions(monkeypatch):
    """Test that items with missing owner or deadline produce deterministic questions without AI calls."""
    client = ClientModel(id="c-1", name="Acme Corp")
    meeting = MeetingModel(id="m-1", client_id="c-1", title="Q4 Sync", meeting_date=date(2026, 10, 15))

    # Task missing owner
    item_no_owner = ItemModel(
        id="item-no-owner",
        meeting_id="m-1",
        item_type="task",
        payload_json={
            "description": "Set up monitoring dashboards",
            "owner": {"name": None, "state": "not_stated"},
            "due": {"resolved_date": "2026-11-01", "state": "stated"},
            "confidence": "high",
            "evidence": [{"quote": "We need dashboards set up."}],
        },
        review_status="needs_review",
    )
    item_no_owner.meeting = meeting

    # Open question
    item_question = ItemModel(
        id="item-q",
        meeting_id="m-1",
        item_type="open_question",
        payload_json={
            "description": "Who will approve the production release?",
            "confidence": "high",
            "evidence": [{"quote": "Who approves release?"}],
        },
        review_status="needs_review",
    )
    item_question.meeting = meeting

    mock_db = MagicMock()
    mock_db.scalar.return_value = client
    mock_db.scalars.return_value = MagicMock(all=lambda: [item_no_owner, item_question])

    res = ClarificationService.get_client_open_items(mock_db, client_id="c-1")
    assert res.total == 2
    assert res.client_name == "Acme Corp"

    # Verify task missing owner
    task_res = next(i for i in res.items if i.id == "item-no-owner")
    assert "owner" in task_res.missing_fields
    assert any("Who is responsible" in q for q in task_res.suggested_questions)

    # Verify open question
    q_res = next(i for i in res.items if i.id == "item-q")
    assert "answer" in q_res.missing_fields
    assert any("Who can confirm the resolution" in q for q in q_res.suggested_questions)


def test_clarification_invalid_client_raises_404(monkeypatch):
    """Querying open items for a non-existent client raises EntityNotFoundError."""
    mock_db = MagicMock()
    mock_db.scalar.return_value = None

    with pytest.raises(EntityNotFoundError):
        ClarificationService.get_client_open_items(mock_db, client_id="non-existent")


def test_meeting_history_summary_counts(monkeypatch):
    """Meeting list returns accurate aggregated item counts (tasks, accepted, needs review, risks, questions)."""
    meeting = MeetingModel(
        id="m-100",
        client_id="c-1",
        title="Architecture Review",
        meeting_date=date(2026, 10, 20),
        raw_text="Meeting transcript text...",
    )
    meeting.client = ClientModel(id="c-1", name="Acme Corp")

    items = [
        ItemModel(id="i1", meeting_id="m-100", item_type="task", review_status="accepted"),
        ItemModel(id="i2", meeting_id="m-100", item_type="task", review_status="needs_review"),
        ItemModel(id="i3", meeting_id="m-100", item_type="risk", review_status="needs_review"),
        ItemModel(id="i4", meeting_id="m-100", item_type="open_question", review_status="needs_review"),
    ]
    meeting.items = items

    mock_db = MagicMock()
    monkeypatch.setattr(MeetingRepository, "list_all", lambda db, **kwargs: ([meeting], 1))

    summaries, total = MeetingService.list_meetings(mock_db, client_id="c-1")
    assert total == 1
    summary = summaries[0]
    assert summary.id == "m-100"
    assert summary.client_name == "Acme Corp"
    assert summary.task_count == 2
    assert summary.accepted_count == 1
    assert summary.needs_review_count == 3
    assert summary.risk_count == 1
    assert summary.question_count == 1


def test_get_missing_meeting_raises_404(monkeypatch):
    """Retrieving a non-existent meeting ID raises EntityNotFoundError."""
    mock_db = MagicMock()
    monkeypatch.setattr(MeetingRepository, "get_by_id", lambda db, mid: None)

    with pytest.raises(EntityNotFoundError):
        MeetingService.get_meeting(mock_db, meeting_id="non-existent-m")

