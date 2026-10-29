from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import Confidence, FieldState, ReviewStatus


class ItemResponse(BaseModel):
    """Schema for returning an extracted action item."""

    id: str
    meeting_id: str
    item_type: str
    payload: dict[str, Any]
    review_status: str
    edited_by_human: bool
    duplicate_of: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ItemListResponse(BaseModel):
    """Paginated list of action items."""

    items: list[ItemResponse]
    total: int


class ItemUpdate(BaseModel):
    """Payload to update an item's review status or field values.

    Rejects unsupported fields, enforces valid states, and preserves null for unstated values.
    """

    review_status: ReviewStatus | None = None
    payload: dict[str, Any] | None = None

    # Granular editable fields
    description: str | None = None
    statement: str | None = None
    question: str | None = None
    owner_name: str | None = None
    owner_state: FieldState | None = None
    raw_date_wording: str | None = None
    resolved_date: date | None = None
    due_date_state: FieldState | None = None
    priority: str | None = None
    confidence: Confidence | None = None
    actor: str | None = None
    action: str = Field(
        "edit", description="Review event action type (accept, reject, edit, merge, split)"
    )

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str | None) -> str | None:
        if v is not None:
            clean = v.strip().lower()
            if clean not in ("low", "medium", "high", "urgent"):
                raise ValueError("Priority must be one of: low, medium, high, urgent")
            return clean
        return v

    @field_validator("owner_name")
    @classmethod
    def validate_owner(cls, v: str | None) -> str | None:
        if v is not None:
            clean = v.strip().lower()
            if clean in (
                "",
                "tbd",
                "n/a",
                "na",
                "unknown",
                "none",
                "not stated",
                "nobody",
                "unassigned",
            ):
                return None
        return v

    model_config = ConfigDict(extra="forbid")


class ItemMergeRequest(BaseModel):
    """Request payload to merge a source item into a canonical target item."""

    source_item_id: str = Field(..., description="ID of source item to merge into this item")
    preferred_description: str | None = Field(
        None, description="Custom description for the consolidated item"
    )
    preferred_owner_name: str | None = Field(None, description="Preferred owner name")
    preferred_due_date: date | None = Field(None, description="Preferred due date")
    combine_evidence: bool = Field(
        default=True, description="Whether to combine evidence quotes from both items"
    )
    actor: str | None = Field(None, description="Reviewer actor identifier")

    model_config = ConfigDict(extra="forbid")


class ItemMergeResponse(BaseModel):
    """Result of merging two action items."""

    canonical_item: ItemResponse
    source_item: ItemResponse
    merged_at: datetime
    notes: str


class SplitSubItem(BaseModel):
    """Sub-task definition for splitting an item."""

    description: str = Field(..., min_length=1, description="Description for sub-task")
    owner_name: str | None = None
    due_date: date | None = None
    priority: str | None = None

    model_config = ConfigDict(extra="forbid")


class ItemSplitRequest(BaseModel):
    """Request payload to split an item into two distinct items."""

    item1: SplitSubItem = Field(..., description="First split item definition")
    item2: SplitSubItem = Field(..., description="Second split item definition")
    actor: str | None = Field(None, description="Reviewer actor identifier")

    model_config = ConfigDict(extra="forbid")


class ItemSplitResponse(BaseModel):
    """Result of splitting an action item."""

    original_item: ItemResponse
    item1: ItemResponse
    item2: ItemResponse
    split_at: datetime
