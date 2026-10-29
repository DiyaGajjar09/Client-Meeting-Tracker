from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.db.models import ClientModel, ItemModel, MeetingModel


class MeetingRepository:
    """Repository handling MySQL persistence for meeting transcripts, metadata, and history metrics."""

    @staticmethod
    def create(
        db: Session,
        client_id: str,
        title: str,
        raw_text: str,
        meeting_date: date | None = None,
        source_filename: str | None = None,
        attendees: list | None = None,
    ) -> MeetingModel:
        """Persist a new meeting record inside a database transaction."""
        meeting = MeetingModel(
            client_id=client_id,
            title=title.strip(),
            raw_text=raw_text,
            meeting_date=meeting_date,
            source_filename=source_filename,
            attendees=attendees or [],
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        return meeting

    @staticmethod
    def get_by_id(db: Session, meeting_id: str) -> MeetingModel | None:
        """Fetch meeting by ID including eager-loaded client, items, and review events."""
        stmt = (
            select(MeetingModel)
            .options(
                joinedload(MeetingModel.client),
                joinedload(MeetingModel.items).joinedload(ItemModel.review_events),
            )
            .where(MeetingModel.id == meeting_id)
        )
        return db.scalars(stmt).unique().first()

    @staticmethod
    def list_all(
        db: Session,
        client_id: str | None = None,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        sort_by: str = "meeting_date",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[MeetingModel], int]:
        """List meetings with search, client, date range filters, sorting, and pagination."""
        count_stmt = select(func.count(MeetingModel.id)).join(
            ClientModel, MeetingModel.client_id == ClientModel.id
        )

        if client_id:
            count_stmt = count_stmt.where(MeetingModel.client_id == client_id)
        if start_date:
            count_stmt = count_stmt.where(MeetingModel.meeting_date >= start_date)
        if end_date:
            count_stmt = count_stmt.where(MeetingModel.meeting_date <= end_date)
        if search:
            q = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    MeetingModel.title.ilike(q),
                    ClientModel.name.ilike(q),
                )
            )

        total = db.scalar(count_stmt) or 0

        list_stmt = (
            select(MeetingModel)
            .join(ClientModel, MeetingModel.client_id == ClientModel.id)
            .options(
                joinedload(MeetingModel.client),
                joinedload(MeetingModel.items),
            )
        )

        if client_id:
            list_stmt = list_stmt.where(MeetingModel.client_id == client_id)
        if start_date:
            list_stmt = list_stmt.where(MeetingModel.meeting_date >= start_date)
        if end_date:
            list_stmt = list_stmt.where(MeetingModel.meeting_date <= end_date)
        if search:
            q = f"%{search.strip()}%"
            list_stmt = list_stmt.where(
                or_(
                    MeetingModel.title.ilike(q),
                    ClientModel.name.ilike(q),
                )
            )

        # Sorting
        order_col = MeetingModel.meeting_date
        if sort_by == "created_at":
            order_col = MeetingModel.created_at
        elif sort_by == "title":
            order_col = MeetingModel.title

        if sort_order.lower() == "asc":
            list_stmt = list_stmt.order_by(order_col.asc().nulls_last())
        else:
            list_stmt = list_stmt.order_by(order_col.desc().nulls_last())

        list_stmt = list_stmt.offset(skip).limit(limit)

        items = list(db.scalars(list_stmt).unique().all())
        return items, total

    @staticmethod
    def delete(db: Session, meeting_id: str) -> bool:
        """Permanently delete meeting by ID."""
        meeting = MeetingRepository.get_by_id(db, meeting_id)
        if not meeting:
            return False
        db.delete(meeting)
        db.commit()
        return True
