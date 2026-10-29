from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field

from app.schemas.common import (
    DecisionPayload,
    OpenQuestionPayload,
    RiskPayload,
    TaskPayload,
)
from app.schemas.item import ItemResponse


class ReExtractionPolicy(StrEnum):
    """Policy for re-extracting meetings that already contain reviewed items."""

    PRESERVE_REVIEWED = "preserve_reviewed"  # Default: keep accepted/edited/rejected items, only extract new or unreviewed
    FORCE_OVERWRITE = (
        "force_overwrite"  # Overwrite unreviewed items, but archive/preserve audit logs
    )


class MeetingExtractionResult(BaseModel):
    """Structured extraction payload produced by LLM for a transcript chunk or meeting."""

    tasks: list[TaskPayload] = Field(
        default_factory=list, description="Actionable tasks and commitments"
    )
    decisions: list[DecisionPayload] = Field(
        default_factory=list, description="Agreed decisions and confirmed directions"
    )
    risks: list[RiskPayload] = Field(
        default_factory=list, description="Identified risks, impacts, and mitigations"
    )
    open_questions: list[OpenQuestionPayload] = Field(
        default_factory=list, description="Unanswered questions needing clarification"
    )


class ExtractMeetingRequest(BaseModel):
    """Request payload to trigger extraction on a saved meeting."""

    policy: ReExtractionPolicy = Field(
        default=ReExtractionPolicy.PRESERVE_REVIEWED,
        description="Re-extraction policy if items already exist for this meeting",
    )
    custom_model: str | None = Field(
        None,
        description="Optional override for Gemini model (e.g. gemini-2.0-flash, gemini-1.5-pro)",
    )


class ExtractionRunResponse(BaseModel):
    """Response returned upon completion of an extraction pipeline run."""

    run_id: str
    meeting_id: str
    model_name: str
    prompt_version: str
    latency_ms: int
    tokens_in: int | None = None
    tokens_out: int | None = None
    tasks_count: int
    decisions_count: int
    risks_count: int
    open_questions_count: int
    validation_ok: bool
    items: list[ItemResponse]
    extracted_at: datetime
    message: str | None = None
