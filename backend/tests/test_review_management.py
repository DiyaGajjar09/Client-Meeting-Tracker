from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.db.models import ItemModel, MeetingModel
from app.repositories.item_repository import ItemRepository
from app.schemas.common import FieldState, ReviewStatus
from app.schemas.item import ItemUpdate
from app.services.item_service import ItemService


def create_fake_task(
    item_id: str = "item-1",
    meeting_id: str = "meeting-1",
    description: str = "Original task description",
    owner_name: str | None = "John Doe",
    owner_state: str = "stated",
    due_date: str | None = "2026-11-15",
    due_state: str = "stated",
    review_status: str = "needs_review",
    edited_by_human: bool = False,
) -> ItemModel:
    meeting = MeetingModel(
        id=meeting_id,
        client_id="client-1",
        title="Sprint Sync",
        raw_text="Priya: Discuss tasks.",
    )
    payload = {
        "id": item_id,
        "description": description,
        "owner": {"name": owner_name, "state": owner_state},
        "due": {"resolved_date": due_date, "state": due_state, "raw_text": "by mid Nov"},
        "priority": "medium",
        "confidence": "high",
        "evidence": [{"quote": "Let's complete this by mid Nov.", "speaker": "John"}],
    }
    item = ItemModel(
        id=item_id,
        meeting_id=meeting_id,
        item_type="task",
        payload_json=payload,
        review_status=review_status,
        edited_by_human=edited_by_human,
        created_at=datetime.now(UTC),
    )
    item.meeting = meeting
    return item


def test_item_update_pydantic_validation_forbids_extra():
    """Ensure unsupported fields are rejected by ItemUpdate."""
    with pytest.raises(ValidationError):
        ItemUpdate.model_validate({"unsupported_field": "some_value"})


def test_item_update_pydantic_enforces_valid_priority():
    """Ensure invalid priorities are rejected."""
    with pytest.raises(ValidationError):
        ItemUpdate.model_validate({"priority": "super_urgent_now"})

    valid = ItemUpdate.model_validate({"priority": "high"})
    assert valid.priority == "high"


def test_item_update_not_stated_owner_enforces_null():
    """Ensure TBD, unknown, or not stated strings become None."""
    update = ItemUpdate.model_validate({"owner_name": "unknown"})
    assert update.owner_name is None


def test_edit_item_sets_edited_by_human(monkeypatch):
    """Reviewer editing task description or fields sets edited_by_human=True and logs audit event."""
    mock_item = create_fake_task()
    mock_db = MagicMock()

    monkeypatch.setattr(ItemRepository, "get_by_id", lambda db, item_id: mock_item)

    updated_mock_item = create_fake_task(description="Updated by human reviewer")
    updated_mock_item.edited_by_human = True

    def mock_update(db, item_id, **kwargs):
        assert kwargs["edited_by_human"] is True
        assert kwargs["action"] == "edit"
        assert kwargs["actor"] == "reviewer@example.com"
        assert kwargs["payload_json"]["description"] == "Updated by human reviewer"
        return updated_mock_item

    monkeypatch.setattr(ItemRepository, "update", mock_update)

    update_in = ItemUpdate(
        description="Updated by human reviewer",
        actor="reviewer@example.com",
        action="edit",
    )
    res = ItemService.update_item(mock_db, "item-1", update_in)
    assert res.edited_by_human is True


def test_accept_and_reject_item(monkeypatch):
    """Reviewer can explicitly accept or reject an item."""
    mock_item = create_fake_task()
    mock_db = MagicMock()

    monkeypatch.setattr(ItemRepository, "get_by_id", lambda db, item_id: mock_item)

    # Test Accept
    accepted_mock = create_fake_task(review_status="accepted")

    def mock_update_accept(db, item_id, **kwargs):
        assert kwargs["review_status"] == "accepted"
        assert kwargs["action"] == "accept"
        return accepted_mock

    monkeypatch.setattr(ItemRepository, "update", mock_update_accept)
    res_accept = ItemService.update_item(
        mock_db, "item-1", ItemUpdate(review_status=ReviewStatus.ACCEPTED, action="accept")
    )
    assert res_accept.review_status == "accepted"

    # Test Reject
    rejected_mock = create_fake_task(review_status="rejected")

    def mock_update_reject(db, item_id, **kwargs):
        assert kwargs["review_status"] == "rejected"
        assert kwargs["action"] == "reject"
        return rejected_mock

    monkeypatch.setattr(ItemRepository, "update", mock_update_reject)
    res_reject = ItemService.update_item(
        mock_db, "item-1", ItemUpdate(review_status=ReviewStatus.REJECTED, action="reject")
    )
    assert res_reject.review_status == "rejected"


def test_preserve_null_for_unstated_owner_and_deadline(monkeypatch):
    """Editing state to not_stated must clear the owner name and date, preserving null values."""
    mock_item = create_fake_task()
    mock_db = MagicMock()

    monkeypatch.setattr(ItemRepository, "get_by_id", lambda db, item_id: mock_item)

    def mock_update(db, item_id, **kwargs):
        payload = kwargs["payload_json"]
        assert payload["owner"]["name"] is None
        assert payload["owner"]["state"] == "not_stated"
        assert payload["due"]["resolved_date"] is None
        assert payload["due"]["state"] == "not_stated"
        return mock_item

    monkeypatch.setattr(ItemRepository, "update", mock_update)

    update_in = ItemUpdate(
        owner_state=FieldState.NOT_STATED,
        due_date_state=FieldState.NOT_STATED,
    )
    ItemService.update_item(mock_db, "item-1", update_in)
