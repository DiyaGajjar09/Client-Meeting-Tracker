from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    DuplicateEntityError,
    EntityNotFoundError,
    InvalidInputError,
    PayloadTooLargeError,
)
from app.db.models import ClientModel
from app.ingestion.parsers import parse_transcript_file
from app.ingestion.speakers import process_transcript_lines
from app.repositories.client_repository import ClientRepository
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.client import ClientCreate, ClientResponse
from app.schemas.item import ItemResponse
from app.schemas.meeting import MeetingDetailResponse, MeetingResponse
from app.schemas.review import MeetingSummaryItem


class MeetingService:
    """Business service orchestrating client and meeting lifecycle operations."""

    @staticmethod
    def create_client(db: Session, client_in: ClientCreate) -> ClientResponse:
        """Create a client organization preventing duplicate normalized names."""
        existing = ClientRepository.get_by_normalized_name(db, client_in.name)
        if existing:
            raise DuplicateEntityError(
                f"A client with the name '{client_in.name}' already exists in the system."
            )

        client = ClientRepository.create(db, client_in.name)
        return ClientResponse(
            id=client.id,
            name=client.name,
            created_at=client.created_at,
        )

    @staticmethod
    def list_clients(
        db: Session, skip: int = 0, limit: int = 100
    ) -> tuple[list[ClientResponse], int]:
        """Fetch all client organizations."""
        items, total = ClientRepository.list_all(db, skip=skip, limit=limit)
        client_responses = [
            ClientResponse(id=c.id, name=c.name, created_at=c.created_at) for c in items
        ]
        return client_responses, total

    @staticmethod
    def get_client(db: Session, client_id: str) -> ClientResponse:
        """Retrieve a specific client by ID."""
        client = ClientRepository.get_by_id(db, client_id)
        if not client:
            raise EntityNotFoundError(f"Client with ID '{client_id}' does not exist.")
        return ClientResponse(id=client.id, name=client.name, created_at=client.created_at)

    @staticmethod
    def delete_client(db: Session, client_id: str) -> None:
        """Permanently delete a client organization and all associated meetings."""
        client = ClientRepository.get_by_id(db, client_id)
        if not client:
            raise EntityNotFoundError(f"Client with ID '{client_id}' does not exist.")
        ClientRepository.delete(db, client_id)

    @staticmethod
    def _validate_client_exists(db: Session, client_id: str) -> ClientModel:
        client = ClientRepository.get_by_id(db, client_id)
        if not client:
            raise EntityNotFoundError(
                f"Cannot associate meeting with non-existent client ID '{client_id}'."
            )
        return client

    @classmethod
    def create_meeting_from_text(
        cls,
        db: Session,
        client_id: str,
        title: str,
        text: str,
        meeting_date: date | None = None,
        attendees: list[str] | None = None,
        source_filename: str | None = None,
    ) -> MeetingResponse:
        """Process and persist a meeting created from pasted text."""
        client = cls._validate_client_exists(db, client_id)

        cleaned_text = text.strip()
        if not cleaned_text:
            raise InvalidInputError("Transcript text cannot be empty or solely whitespace.")

        if len(cleaned_text) > settings.MAX_PASTED_TEXT_CHARS:
            raise PayloadTooLargeError(
                f"Pasted transcript length ({len(cleaned_text)} chars) exceeds maximum limit of {settings.MAX_PASTED_TEXT_CHARS} chars."
            )

        normalized_text, indexed_lines = process_transcript_lines(cleaned_text)

        meeting = MeetingRepository.create(
            db=db,
            client_id=client.id,
            title=title.strip(),
            raw_text=normalized_text,
            meeting_date=meeting_date,
            source_filename=source_filename,
            attendees=attendees or [],
        )

        return MeetingResponse(
            id=meeting.id,
            client_id=meeting.client_id,
            client_name=client.name,
            title=meeting.title,
            meeting_date=meeting.meeting_date,
            source_filename=meeting.source_filename,
            attendees=meeting.attendees or [],
            created_at=meeting.created_at,
            line_count=len(indexed_lines),
            text_length=len(meeting.raw_text),
        )

    @classmethod
    def create_meeting_from_upload(
        cls,
        db: Session,
        client_id: str,
        title: str,
        filename: str,
        file_bytes: bytes,
        meeting_date: date | None = None,
        attendees: list[str] | None = None,
    ) -> MeetingResponse:
        """Process and persist a meeting created from an uploaded document."""
        client = cls._validate_client_exists(db, client_id)

        parsed_text, safe_filename = parse_transcript_file(filename, file_bytes)
        normalized_text, indexed_lines = process_transcript_lines(parsed_text)

        meeting = MeetingRepository.create(
            db=db,
            client_id=client.id,
            title=title.strip(),
            raw_text=normalized_text,
            meeting_date=meeting_date,
            source_filename=safe_filename,
            attendees=attendees or [],
        )

        return MeetingResponse(
            id=meeting.id,
            client_id=meeting.client_id,
            client_name=client.name,
            title=meeting.title,
            meeting_date=meeting.meeting_date,
            source_filename=meeting.source_filename,
            attendees=meeting.attendees or [],
            created_at=meeting.created_at,
            line_count=len(indexed_lines),
            text_length=len(meeting.raw_text),
        )

    @staticmethod
    def get_meeting(db: Session, meeting_id: str) -> MeetingDetailResponse:
        """Retrieve full meeting details including verbatim transcript and extracted items."""
        meeting = MeetingRepository.get_by_id(db, meeting_id)
        if not meeting:
            raise EntityNotFoundError(f"Meeting with ID '{meeting_id}' not found.")

        line_count = len([line for line in meeting.raw_text.splitlines() if line.strip()])
        items = [
            ItemResponse(
                id=it.id,
                meeting_id=it.meeting_id,
                item_type=it.item_type,
                payload=it.payload_json,
                review_status=it.review_status,
                edited_by_human=it.edited_by_human,
                duplicate_of=it.duplicate_of,
                created_at=it.created_at,
            )
            for it in (meeting.items or [])
        ]
        return MeetingDetailResponse(
            id=meeting.id,
            client_id=meeting.client_id,
            client_name=meeting.client.name if meeting.client else None,
            title=meeting.title,
            meeting_date=meeting.meeting_date,
            source_filename=meeting.source_filename,
            attendees=meeting.attendees or [],
            created_at=meeting.created_at,
            line_count=line_count,
            text_length=len(meeting.raw_text),
            raw_text=meeting.raw_text,
            items=items,
        )

    @staticmethod
    def delete_meeting(db: Session, meeting_id: str) -> None:
        """Permanently delete a meeting record and its cascading items, runs, review events."""
        meeting = MeetingRepository.get_by_id(db, meeting_id)
        if not meeting:
            raise EntityNotFoundError(f"Meeting with ID '{meeting_id}' not found.")
        MeetingRepository.delete(db, meeting_id)

    @staticmethod
    def cleanup_expired_meetings(db: Session, retention_days: int | None = None) -> int:
        """Enforce configured data retention policy (default 90 days).

        Permanently deletes meetings and cascading records created before the retention cutoff.
        """
        from datetime import UTC, datetime, timedelta

        from sqlalchemy import select

        from app.db.models import MeetingModel

        days = retention_days or settings.RETENTION_DAYS
        cutoff = datetime.now(UTC) - timedelta(days=days)

        expired_meetings = db.scalars(
            select(MeetingModel).where(MeetingModel.created_at < cutoff)
        ).all()

        deleted_count = 0
        for m in expired_meetings:
            db.delete(m)
            deleted_count += 1

        if deleted_count > 0:
            db.commit()

        return deleted_count

    @staticmethod
    def list_meetings(
        db: Session,
        client_id: str | None = None,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        sort_by: str = "meeting_date",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[MeetingSummaryItem], int]:
        """List meetings with search, client, date range filters, sorting, and item counts."""
        items, total = MeetingRepository.list_all(
            db,
            client_id=client_id,
            search=search,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )
        summaries: list[MeetingSummaryItem] = []
        for m in items:
            m_items = m.items or []
            task_count = sum(1 for it in m_items if it.item_type == "task")
            accepted_count = sum(1 for it in m_items if it.review_status == "accepted")
            needs_review_count = sum(
                1 for it in m_items if it.review_status == "needs_review"
            )
            risk_count = sum(1 for it in m_items if it.item_type == "risk")
            question_count = sum(1 for it in m_items if it.item_type == "open_question")

            summaries.append(
                MeetingSummaryItem(
                    id=m.id,
                    client_id=m.client_id,
                    client_name=m.client.name if m.client else "",
                    title=m.title,
                    meeting_date=m.meeting_date,
                    source_filename=m.source_filename,
                    created_at=m.created_at,
                    attendees=m.attendees or [],
                    task_count=task_count,
                    accepted_count=accepted_count,
                    needs_review_count=needs_review_count,
                    risk_count=risk_count,
                    question_count=question_count,
                )
            )
        return summaries, total
