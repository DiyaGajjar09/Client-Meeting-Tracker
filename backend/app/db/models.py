import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.mysql import JSON, MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def generate_uuid() -> str:
    """Generate standard UUID4 string for primary keys."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Current UTC timestamp for Python-side defaults."""
    return datetime.now(UTC)


class ClientModel(Base):
    """Clients table for persistent organization records in MySQL."""

    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    meetings: Mapped[list["MeetingModel"]] = relationship(
        "MeetingModel",
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="desc(MeetingModel.created_at)",
    )

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "created_at" not in kwargs or not kwargs["created_at"]:
            kwargs["created_at"] = utc_now()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Client(id='{self.id}', name='{self.name}')>"


class MeetingModel(Base):
    """Meetings table storing transcript text and metadata in MySQL."""

    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # MEDIUMTEXT in MySQL supports up to 16MB of raw transcript text
    raw_text: Mapped[str] = mapped_column(MEDIUMTEXT, nullable=False)
    attendees: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    client: Mapped["ClientModel"] = relationship("ClientModel", back_populates="meetings")
    items: Mapped[list["ItemModel"]] = relationship(
        "ItemModel",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )
    runs: Mapped[list["RunModel"]] = relationship(
        "RunModel",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("idx_meetings_client_date", "client_id", "meeting_date"),)

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "created_at" not in kwargs or not kwargs["created_at"]:
            kwargs["created_at"] = utc_now()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Meeting(id='{self.id}', client_id='{self.client_id}', title='{self.title}')>"


class ItemModel(Base):
    """Extracted tasks, decisions, risks, and open questions in MySQL."""

    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # task, decision, risk, open_question
    # Native MySQL JSON for high-performance payload queries and integrity
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    review_status: Mapped[str] = mapped_column(
        String(50), default="needs_review", nullable=False, index=True
    )  # needs_review, accepted, rejected
    edited_by_human: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    duplicate_of: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    meeting: Mapped["MeetingModel"] = relationship("MeetingModel", back_populates="items")
    review_events: Mapped[list["ReviewEventModel"]] = relationship(
        "ReviewEventModel",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="desc(ReviewEventModel.timestamp)",
    )

    __table_args__ = (
        Index("idx_items_meeting_type_status", "meeting_id", "item_type", "review_status"),
    )

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "created_at" not in kwargs or not kwargs["created_at"]:
            kwargs["created_at"] = utc_now()
        if "edited_by_human" not in kwargs:
            kwargs["edited_by_human"] = False
        if "review_status" not in kwargs:
            kwargs["review_status"] = "needs_review"
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Item(id='{self.id}', type='{self.item_type}', status='{self.review_status}')>"


class ReviewEventModel(Base):
    """Audit log of human review decisions, edits, splits, and merges in MySQL."""

    __tablename__ = "review_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # edit, accept, reject, merge, split, duplicate_kept, duplicate_discarded
    old_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    item: Mapped["ItemModel"] = relationship("ItemModel", back_populates="review_events")

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "timestamp" not in kwargs or not kwargs["timestamp"]:
            kwargs["timestamp"] = utc_now()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<ReviewEvent(id='{self.id}', item_id='{self.item_id}', action='{self.action}')>"


class DuplicateResolutionModel(Base):
    """Persisted duplicate review decisions (keep_both, merged, discarded)."""

    __tablename__ = "duplicate_resolutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    client_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item1_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item2_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resolution: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # keep_both, merged, discarded
    canonical_item_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("items.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_dup_res_pair", "item1_id", "item2_id", unique=True),
        Index("idx_dup_res_client", "client_id", "resolution"),
    )

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "created_at" not in kwargs or not kwargs["created_at"]:
            kwargs["created_at"] = utc_now()
        if "updated_at" not in kwargs or not kwargs["updated_at"]:
            kwargs["updated_at"] = utc_now()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<DuplicateResolution(item1='{self.item1_id}', item2='{self.item2_id}', res='{self.resolution}')>"


class RunModel(Base):
    """Operational metrics and validation outcomes of extraction runs in MySQL."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    validation_ok: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    meeting: Mapped["MeetingModel"] = relationship("MeetingModel", back_populates="runs")

    def __init__(self, **kwargs):
        if "id" not in kwargs or not kwargs["id"]:
            kwargs["id"] = generate_uuid()
        if "created_at" not in kwargs or not kwargs["created_at"]:
            kwargs["created_at"] = utc_now()
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Run(id='{self.id}', meeting_id='{self.meeting_id}', model='{self.model_name}')>"
