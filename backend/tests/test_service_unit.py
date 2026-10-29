from unittest.mock import MagicMock

import pytest

from app.core.exceptions import (
    DuplicateEntityError,
    EntityNotFoundError,
    InvalidInputError,
    PayloadTooLargeError,
)
from app.db.models import ClientModel
from app.schemas.client import ClientCreate
from app.services.meeting_service import MeetingService


def test_service_create_client_duplicate_rejected():
    """Unit test: MeetingService raises DuplicateEntityError when client name exists."""
    mock_db = MagicMock()
    existing_client = ClientModel(id="c1", name="Acme Corp")

    # Mock repository returning existing client
    mock_db.scalars.return_value.first.return_value = existing_client

    with pytest.raises(DuplicateEntityError) as exc_info:
        MeetingService.create_client(mock_db, ClientCreate(name="Acme Corp"))
    assert "already exists" in str(exc_info.value)


def test_service_create_client_success():
    """Unit test: MeetingService creates and returns client when name is unique."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None  # No existing client

    res = MeetingService.create_client(mock_db, ClientCreate(name="New Enterprise"))
    assert res.name == "New Enterprise"
    assert mock_db.add.called
    assert mock_db.commit.called


def test_service_create_meeting_missing_client_404():
    """Unit test: MeetingService raises EntityNotFoundError when client does not exist."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None  # Client not found

    with pytest.raises(EntityNotFoundError) as exc_info:
        MeetingService.create_meeting_from_text(
            db=mock_db,
            client_id="invalid-id",
            title="Sprint Review",
            text="Priya: Discussing tasks.",
        )
    assert "non-existent client ID" in str(exc_info.value)


def test_service_create_meeting_empty_text():
    """Unit test: MeetingService rejects empty transcript text."""
    mock_db = MagicMock()
    mock_client = ClientModel(id="c1", name="Acme Corp")
    mock_db.scalars.return_value.first.return_value = mock_client

    with pytest.raises(InvalidInputError):
        MeetingService.create_meeting_from_text(
            db=mock_db,
            client_id="c1",
            title="Sprint Review",
            text="    ",
        )


def test_service_create_meeting_oversized_text():
    """Unit test: MeetingService rejects transcript exceeding MAX_PASTED_TEXT_CHARS."""
    mock_db = MagicMock()
    mock_client = ClientModel(id="c1", name="Acme Corp")
    mock_db.scalars.return_value.first.return_value = mock_client

    oversized = "A" * 150001
    with pytest.raises(PayloadTooLargeError):
        MeetingService.create_meeting_from_text(
            db=mock_db,
            client_id="c1",
            title="Sprint Review",
            text=oversized,
        )


def test_service_create_meeting_success():
    """Unit test: MeetingService parses speaker turns, line count, and persists meeting."""
    mock_db = MagicMock()
    mock_client = ClientModel(id="c1", name="Acme Corp")
    mock_db.scalars.return_value.first.return_value = mock_client

    transcript = (
        "[00:10:00] Priya: We will deliver the MySQL schema on Monday.\n"
        "[00:10:15] Rahul: I will review and sign off."
    )

    res = MeetingService.create_meeting_from_text(
        db=mock_db,
        client_id="c1",
        title="Weekly Sync",
        text=transcript,
    )
    assert res.title == "Weekly Sync"
    assert res.line_count == 2
    assert res.client_name == "Acme Corp"
    assert mock_db.commit.called


def test_service_delete_client_success():
    """Unit test: MeetingService deletes client and commits."""
    mock_db = MagicMock()
    mock_client = ClientModel(id="c1", name="Acme Corp")
    mock_db.scalars.return_value.first.return_value = mock_client

    MeetingService.delete_client(mock_db, client_id="c1")
    assert mock_db.delete.called
    assert mock_db.commit.called


def test_service_delete_client_not_found():
    """Unit test: MeetingService raises EntityNotFoundError if client doesn't exist."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None

    with pytest.raises(EntityNotFoundError):
        MeetingService.delete_client(mock_db, client_id="nonexistent")


def test_service_delete_meeting_success():
    """Unit test: MeetingService deletes meeting and commits."""
    from app.db.models import MeetingModel

    mock_db = MagicMock()
    mock_meeting = MeetingModel(id="m1", client_id="c1", title="Sync", raw_text="Priya: Hi")
    mock_db.scalars.return_value.first.return_value = mock_meeting
    mock_db.scalars.return_value.unique.return_value.first.return_value = mock_meeting

    MeetingService.delete_meeting(mock_db, meeting_id="m1")
    assert mock_db.delete.called
    assert mock_db.commit.called


def test_service_delete_meeting_not_found():
    """Unit test: MeetingService raises EntityNotFoundError if meeting doesn't exist."""
    mock_db = MagicMock()
    mock_db.scalars.return_value.first.return_value = None
    mock_db.scalars.return_value.unique.return_value.first.return_value = None

    with pytest.raises(EntityNotFoundError):
        MeetingService.delete_meeting(mock_db, meeting_id="nonexistent")
