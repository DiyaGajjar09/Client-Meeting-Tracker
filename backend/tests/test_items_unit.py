from unittest.mock import MagicMock

import pytest

from app.core.exceptions import EntityNotFoundError
from app.db.models import ItemModel
from app.schemas.common import ReviewStatus
from app.schemas.item import ItemUpdate
from app.services.item_service import ItemService


def test_item_service_get_item_not_found():
    """Unit test: ItemService raises 404 when item does not exist."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None

    with pytest.raises(EntityNotFoundError):
        ItemService.get_item(mock_db, item_id="nonexistent")


def test_item_service_get_item_success():
    """Unit test: ItemService returns mapped item response."""
    mock_db = MagicMock()
    mock_item = ItemModel(
        id="i1",
        meeting_id="m1",
        item_type="task",
        payload_json={"description": "Ship feature"},
        review_status="needs_review",
    )
    mock_db.scalars.return_value.first.return_value = mock_item

    res = ItemService.get_item(mock_db, item_id="i1")
    assert res.id == "i1"
    assert res.item_type == "task"
    assert res.review_status == "needs_review"
    assert res.payload["description"] == "Ship feature"


def test_item_service_update_item_success():
    """Unit test: ItemService updates review status and appends audit event."""
    mock_db = MagicMock()
    mock_item = ItemModel(
        id="i1",
        meeting_id="m1",
        item_type="task",
        payload_json={"description": "Ship feature"},
        review_status="needs_review",
    )
    mock_db.scalars.return_value.first.return_value = mock_item

    update_in = ItemUpdate(review_status=ReviewStatus.ACCEPTED, action="accept")
    res = ItemService.update_item(mock_db, item_id="i1", update_in=update_in)
    assert res.review_status == "accepted"
    assert mock_db.commit.called


def test_item_service_delete_item_success():
    """Unit test: ItemService deletes item successfully."""
    mock_db = MagicMock()
    mock_item = ItemModel(
        id="i1",
        meeting_id="m1",
        item_type="task",
        payload_json={},
        review_status="needs_review",
    )
    mock_db.scalars.return_value.first.return_value = mock_item

    ItemService.delete_item(mock_db, item_id="i1")
    assert mock_db.delete.called
    assert mock_db.commit.called


def test_item_service_delete_item_not_found():
    """Unit test: ItemService raises EntityNotFoundError on non-existent item delete."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None

    with pytest.raises(EntityNotFoundError):
        ItemService.delete_item(mock_db, item_id="nonexistent")
