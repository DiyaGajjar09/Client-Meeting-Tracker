from datetime import date
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class FieldState(StrEnum):
    """Explicit truth-state of an extracted field."""

    STATED = "stated"
    IMPLIED = "implied"
    NOT_STATED = "not_stated"


class Confidence(StrEnum):
    """Model confidence score categorization."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReviewStatus(StrEnum):
    """Review cycle states for an action item."""

    NEEDS_REVIEW = "needs_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    MERGED = "merged"


class ItemType(StrEnum):
    """Supported extracted item types."""

    TASK = "task"
    DECISION = "decision"
    RISK = "risk"
    OPEN_QUESTION = "open_question"


class Evidence(BaseModel):
    """Verbatim transcript quote backing an extraction."""

    quote: str = Field(..., description="Exact words from the meeting transcript", min_length=1)
    speaker: str | None = Field(None, description="Speaker name if identified")
    line_start: int | None = Field(None, description="Starting line number in source text", ge=1)
    line_end: int | None = Field(None, description="Ending line number in source text", ge=1)

    model_config = ConfigDict(extra="ignore")


class Owner(BaseModel):
    """Task or risk owner with explicit uncertainty state."""

    name: str | None = Field(None, description="Owner name or null if not stated")
    state: FieldState = Field(default=FieldState.NOT_STATED, description="Certainty state of owner")
    note: str | None = Field(None, description="Contextual explanation for owner assignment")

    @field_validator("name")
    @classmethod
    def validate_name_not_stated(cls, v: str | None, info) -> str | None:
        # Enforce PRD Hard Rule 1: "not_stated" owner must be null. No TBD, N/A, or fake strings.
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

    model_config = ConfigDict(extra="ignore")


class DueDate(BaseModel):
    """Task or commitment deadline with explicit resolution state."""

    raw_text: str | None = Field(None, description="Verbatim wording e.g. 'by next Friday'")
    resolved_date: date | None = Field(
        None, description="Resolved calendar date or null if not stated"
    )
    state: FieldState = Field(default=FieldState.NOT_STATED, description="Certainty state of date")
    note: str | None = Field(None, description="Contextual note regarding the date")

    model_config = ConfigDict(extra="ignore")


class TaskPayload(BaseModel):
    """Structured payload for an extracted task."""

    id: str
    description: str
    owner: Owner
    due: DueDate
    priority: str | None = None  # low / medium / high
    depends_on: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.MEDIUM
    evidence: list[Evidence] = Field(default_factory=list)
    clarification_needed: list[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class DecisionPayload(BaseModel):
    """Structured payload for an agreed meeting decision."""

    id: str
    statement: str
    decided_by: str | None = None
    confidence: Confidence = Confidence.HIGH
    evidence: list[Evidence] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class RiskPayload(BaseModel):
    """Structured payload for an identified project risk."""

    id: str
    description: str
    impact: str | None = None
    mitigation: str | None = None
    raised_by: str | None = None
    owner: Owner = Field(default_factory=lambda: Owner(name=None, state=FieldState.NOT_STATED))
    confidence: Confidence = Confidence.MEDIUM
    evidence: list[Evidence] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class OpenQuestionPayload(BaseModel):
    """Structured payload for an unresolved question."""

    id: str
    question: str
    asked_by: str | None = None
    directed_to: Owner = Field(
        default_factory=lambda: Owner(name=None, state=FieldState.NOT_STATED)
    )
    needed_by: DueDate = Field(default_factory=lambda: DueDate(state=FieldState.NOT_STATED))
    confidence: Confidence = Confidence.MEDIUM
    evidence: list[Evidence] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class ErrorResponse(BaseModel):
    """Standardized API error response format."""

    error: str
    code: str
    detail: Any | None = None
