from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReviewEventResponse(BaseModel):
    """Schema for audit review events."""

    id: str
    item_id: str
    action: str
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    actor: str | None = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class DuplicateTaskDetail(BaseModel):
    """Task details in duplicate comparison card."""

    id: str
    meeting_id: str
    meeting_title: str
    meeting_date: str | None = None
    description: str
    owner: str | None = None
    due_date: Any = None
    review_status: str
    confidence: str = "medium"
    evidence_quote: str | None = None


class DuplicateCandidateResponse(BaseModel):
    """Pair of duplicate tasks with similarity score and metadata."""

    id: str
    similarity_score: float
    match_category: str
    status: str = "pending"
    current_task: DuplicateTaskDetail
    candidate_task: DuplicateTaskDetail


class DuplicateResolveRequest(BaseModel):
    """Resolution decision for a duplicate task pair."""

    item1_id: str = Field(..., description="First item in duplicate pair")
    item2_id: str = Field(..., description="Second item in duplicate pair")
    resolution: str = Field(
        ...,
        description="Resolution decision: keep_both, merged, discarded",
    )
    canonical_item_id: str | None = Field(
        None, description="Canonical item ID if resolution is merged"
    )
    actor: str | None = Field(None, description="Reviewer actor identifier")

    model_config = ConfigDict(extra="forbid")


class DuplicateResolveResponse(BaseModel):
    """Confirmation of duplicate resolution."""

    id: str
    client_id: str
    item1_id: str
    item2_id: str
    resolution: str
    status: str
    updated_at: datetime


class ClarificationItemResponse(BaseModel):
    """Action item requiring stakeholder clarification."""

    id: str
    meeting_id: str
    meeting_title: str
    meeting_date: str | None = None
    item_type: str
    description: str
    owner_name: str | None = None
    owner_state: str = "not_stated"
    resolved_date: str | None = None
    due_date_state: str = "not_stated"
    confidence: str = "medium"
    missing_fields: list[str] = Field(default_factory=list)
    evidence_quotes: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)


class ClarificationListResponse(BaseModel):
    """List of items needing clarification for a client."""

    client_id: str
    client_name: str
    items: list[ClarificationItemResponse]
    total: int


class MeetingSummaryItem(BaseModel):
    """Meeting summary with item status metrics for history view."""

    id: str
    client_id: str
    client_name: str
    title: str
    meeting_date: date | None = None
    source_filename: str | None = None
    created_at: datetime
    attendees: list[str] | None = None
    task_count: int = 0
    accepted_count: int = 0
    needs_review_count: int = 0
    risk_count: int = 0
    question_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class MeetingHistoryResponse(BaseModel):
    """Paginated meeting history response with summary counts."""

    items: list[MeetingSummaryItem]
    total: int
    page: int
    page_size: int

