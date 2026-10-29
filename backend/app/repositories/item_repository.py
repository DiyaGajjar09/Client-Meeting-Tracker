from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.models import DuplicateResolutionModel, ItemModel, ReviewEventModel


class ItemRepository:
    """Repository handling MySQL persistence for extracted action items, merges, splits, and audit events."""

    @staticmethod
    def get_by_id(db: Session, item_id: str) -> ItemModel | None:
        """Fetch item by ID including meeting relation."""
        stmt = (
            select(ItemModel).options(joinedload(ItemModel.meeting)).where(ItemModel.id == item_id)
        )
        return db.scalars(stmt).first()

    @staticmethod
    def list_all(
        db: Session,
        meeting_id: str | None = None,
        item_type: str | None = None,
        review_status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[ItemModel], int]:
        """List items with optional meeting, type, and status filters."""
        count_stmt = select(func.count(ItemModel.id))
        if meeting_id:
            count_stmt = count_stmt.where(ItemModel.meeting_id == meeting_id)
        if item_type:
            count_stmt = count_stmt.where(ItemModel.item_type == item_type)
        if review_status:
            count_stmt = count_stmt.where(ItemModel.review_status == review_status)
        total = db.scalar(count_stmt) or 0

        list_stmt = (
            select(ItemModel)
            .options(joinedload(ItemModel.meeting))
            .order_by(ItemModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        if meeting_id:
            list_stmt = list_stmt.where(ItemModel.meeting_id == meeting_id)
        if item_type:
            list_stmt = list_stmt.where(ItemModel.item_type == item_type)
        if review_status:
            list_stmt = list_stmt.where(ItemModel.review_status == review_status)

        items = list(db.scalars(list_stmt).all())
        return items, total

    @staticmethod
    def create(
        db: Session,
        meeting_id: str,
        item_type: str,
        payload_json: dict,
        review_status: str = "needs_review",
    ) -> ItemModel:
        """Persist a new action item in MySQL."""
        item = ItemModel(
            meeting_id=meeting_id,
            item_type=item_type,
            payload_json=payload_json,
            review_status=review_status,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update(
        db: Session,
        item_id: str,
        review_status: str | None = None,
        payload_json: dict | None = None,
        edited_by_human: bool = True,
        action: str = "edit",
        actor: str | None = None,
        old_value: dict | None = None,
    ) -> ItemModel | None:
        """Update item fields and append an immutable review event."""
        item = ItemRepository.get_by_id(db, item_id)
        if not item:
            return None

        if review_status is not None:
            item.review_status = review_status
        if payload_json is not None:
            item.payload_json = payload_json
        item.edited_by_human = edited_by_human

        # Create audit review event
        event = ReviewEventModel(
            item_id=item.id,
            action=action,
            actor=actor,
            old_value=old_value,
            new_value={"review_status": item.review_status, "payload": item.payload_json},
        )
        db.add(event)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def log_review_event(
        db: Session,
        item_id: str,
        action: str,
        old_value: dict | None = None,
        new_value: dict | None = None,
        actor: str | None = None,
    ) -> ReviewEventModel:
        """Log an immutable review event record."""
        event = ReviewEventModel(
            item_id=item_id,
            action=action,
            actor=actor,
            old_value=old_value,
            new_value=new_value,
        )
        db.add(event)
        return event

    @staticmethod
    def list_review_events(
        db: Session,
        item_id: str | None = None,
        meeting_id: str | None = None,
    ) -> list[ReviewEventModel]:
        """Fetch review events for an item or meeting."""
        stmt = (
            select(ReviewEventModel)
            .join(ItemModel, ReviewEventModel.item_id == ItemModel.id)
            .order_by(ReviewEventModel.timestamp.desc())
        )
        if item_id:
            stmt = stmt.where(ReviewEventModel.item_id == item_id)
        if meeting_id:
            stmt = stmt.where(ItemModel.meeting_id == meeting_id)
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_duplicate_resolution(
        db: Session,
        item1_id: str,
        item2_id: str,
    ) -> DuplicateResolutionModel | None:
        """Fetch existing resolution for an item pair."""
        p1, p2 = min(item1_id, item2_id), max(item1_id, item2_id)
        return db.scalar(
            select(DuplicateResolutionModel).where(
                DuplicateResolutionModel.item1_id == p1,
                DuplicateResolutionModel.item2_id == p2,
            )
        )

    @staticmethod
    def save_duplicate_resolution(
        db: Session,
        client_id: str,
        item1_id: str,
        item2_id: str,
        resolution: str,
        canonical_item_id: str | None = None,
    ) -> DuplicateResolutionModel:
        """Persist or update duplicate candidate resolution."""
        p1, p2 = min(item1_id, item2_id), max(item1_id, item2_id)
        res = db.scalar(
            select(DuplicateResolutionModel).where(
                DuplicateResolutionModel.item1_id == p1,
                DuplicateResolutionModel.item2_id == p2,
            )
        )
        if not res:
            res = DuplicateResolutionModel(
                client_id=client_id,
                item1_id=p1,
                item2_id=p2,
                resolution=resolution,
                canonical_item_id=canonical_item_id,
            )
            db.add(res)
        else:
            res.resolution = resolution
            res.canonical_item_id = canonical_item_id

        db.commit()
        db.refresh(res)
        return res

    @staticmethod
    def delete(db: Session, item_id: str) -> bool:
        """Permanently delete an action item and its review history."""
        item = ItemRepository.get_by_id(db, item_id)
        if not item:
            return False
        db.delete(item)
        db.commit()
        return True
