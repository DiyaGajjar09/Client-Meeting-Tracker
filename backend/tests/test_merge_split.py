from datetime import date
from unittest.mock import MagicMock

import pytest

from app.core.exceptions import InvalidInputError
from app.db.models import ItemModel, MeetingModel
from app.repositories.item_repository import ItemRepository
from app.schemas.item import ItemMergeRequest, ItemSplitRequest, SplitSubItem
from app.services.item_service import ItemService


def create_task_item(
    item_id: str,
    client_id: str,
    item_type: str = "task",
    description: str = "Task description",
    evidence_quote: str = "Evidence quote",
) -> ItemModel:
    meeting = MeetingModel(
        id=f"m-{item_id}",
        client_id=client_id,
        title=f"Meeting for {item_id}",
        raw_text=f"Transcript with {evidence_quote}",
    )
    payload = {
        "id": item_id,
        "description": description,
        "owner": {"name": "Alice", "state": "stated"},
        "due": {"resolved_date": "2026-11-20", "state": "stated"},
        "evidence": [{"quote": evidence_quote, "speaker": "Alice"}],
    }
    item = ItemModel(
        id=item_id,
        meeting_id=meeting.id,
        item_type=item_type,
        payload_json=payload,
        review_status="needs_review",
    )
    item.meeting = meeting
    return item


def test_merge_items_success(monkeypatch):
    """Merging two tasks of same client consolidates evidence and updates statuses."""
    item1 = create_task_item("item-1", "client-A", description="Draft project outline", evidence_quote="Quote 1")
    item2 = create_task_item("item-2", "client-A", description="Draft project charter", evidence_quote="Quote 2")
    mock_db = MagicMock()

    def mock_get(db, iid):
        if iid == "item-1":
            return item1
        if iid == "item-2":
            return item2
        return None

    monkeypatch.setattr(ItemRepository, "get_by_id", mock_get)
    monkeypatch.setattr(ItemRepository, "log_review_event", lambda **kwargs: None)
    monkeypatch.setattr(ItemRepository, "save_duplicate_resolution", lambda **kwargs: None)

    req = ItemMergeRequest(
        source_item_id="item-2",
        preferred_description="Consolidated project charter and outline",
        combine_evidence=True,
    )

    res = ItemService.merge_items(mock_db, canonical_id="item-1", merge_in=req)

    assert res.canonical_item.id == "item-1"
    assert res.canonical_item.payload["description"] == "Consolidated project charter and outline"
    # Verify evidence preserved from both items
    quotes = [e["quote"] for e in res.canonical_item.payload["evidence"]]
    assert "Quote 1" in quotes
    assert "Quote 2" in quotes

    # Source item should be merged and linked to canonical item
    assert res.source_item.review_status == "merged"
    assert res.source_item.duplicate_of == "item-1"


def test_merge_items_client_isolation(monkeypatch):
    """Attempting to merge items from different clients must be strictly rejected with InvalidInputError."""
    item1 = create_task_item("item-1", "client-A")
    item2 = create_task_item("item-2", "client-B")  # Different client!
    mock_db = MagicMock()

    monkeypatch.setattr(
        ItemRepository,
        "get_by_id",
        lambda db, iid: item1 if iid == "item-1" else item2,
    )

    req = ItemMergeRequest(source_item_id="item-2")
    with pytest.raises(InvalidInputError) as exc:
        ItemService.merge_items(mock_db, canonical_id="item-1", merge_in=req)
    assert "different clients" in str(exc.value)


def test_merge_items_incompatible_types(monkeypatch):
    """Merging a task with a decision must be rejected."""
    item1 = create_task_item("item-1", "client-A", item_type="task")
    item2 = create_task_item("item-2", "client-A", item_type="decision")
    mock_db = MagicMock()

    monkeypatch.setattr(
        ItemRepository,
        "get_by_id",
        lambda db, iid: item1 if iid == "item-1" else item2,
    )

    req = ItemMergeRequest(source_item_id="item-2")
    with pytest.raises(InvalidInputError) as exc:
        ItemService.merge_items(mock_db, canonical_id="item-1", merge_in=req)
    assert "incompatible item types" in str(exc.value)


def test_merge_items_self_merge_rejected(monkeypatch):
    """Merging an item into itself must be rejected."""
    mock_db = MagicMock()
    req = ItemMergeRequest(source_item_id="item-1")
    with pytest.raises(InvalidInputError) as exc:
        ItemService.merge_items(mock_db, canonical_id="item-1", merge_in=req)
    assert "itself" in str(exc.value)


def test_split_item_success(monkeypatch):
    """Splitting an item produces two distinct records with unique IDs and preserves evidence."""
    orig_item = create_task_item(
        "orig-item",
        "client-A",
        description="Migrate DB and configure backups",
        evidence_quote="Original discussion quote",
    )
    mock_db = MagicMock()

    monkeypatch.setattr(ItemRepository, "get_by_id", lambda db, iid: orig_item)
    monkeypatch.setattr(ItemRepository, "log_review_event", lambda **kwargs: None)

    split_req = ItemSplitRequest(
        item1=SplitSubItem(
            description="Migrate database schema",
            owner_name="DevOps Lead",
            due_date=date(2026, 11, 25),
        ),
        item2=SplitSubItem(
            description="Configure automated backups",
            owner_name=None,  # No invented owner
            due_date=None,
        ),
        actor="lead_reviewer@example.com",
    )

    res = ItemService.split_item(mock_db, item_id="orig-item", split_in=split_req)

    assert res.item1.id != res.item2.id
    assert res.item1.id != "orig-item"
    assert res.item1.payload["description"] == "Migrate database schema"
    assert res.item2.payload["description"] == "Configure automated backups"

    # Evidence preserved
    assert res.item1.payload["evidence"][0]["quote"] == "Original discussion quote"
    assert res.item2.payload["evidence"][0]["quote"] == "Original discussion quote"

    # No invented owner for item 2
    assert res.item2.payload["owner"]["name"] is None
    assert res.item2.payload["owner"]["state"] == "not_stated"

    # Original item is retained with merged/split review status
    assert res.original_item.review_status == "merged"


def test_split_item_transaction_rollback_on_failure(monkeypatch):
    """If an error occurs during split creation, transaction rolls back."""
    orig_item = create_task_item("orig-item", "client-A")
    mock_db = MagicMock()
    mock_db.commit.side_effect = RuntimeError("Database constraint failure")

    monkeypatch.setattr(ItemRepository, "get_by_id", lambda db, iid: orig_item)

    split_req = ItemSplitRequest(
        item1=SplitSubItem(description="Part 1"),
        item2=SplitSubItem(description="Part 2"),
    )

    with pytest.raises(RuntimeError):
        ItemService.split_item(mock_db, item_id="orig-item", split_in=split_req)

    mock_db.rollback.assert_called_once()

