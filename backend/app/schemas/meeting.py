from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.item import ItemResponse


class MeetingCreateJson(BaseModel):
    """Request schema for creating a meeting from JSON (pasted transcript text)."""

    client_id: str = Field(..., description="ID of existing client organization")
    title: str = Field(..., description="Meeting title or subject", min_length=1, max_length=255)
    meeting_date: date | None = Field(None, description="Date the meeting took place")
    attendees: list[str] = Field(default_factory=list, description="List of participant names")
    text: str = Field(
        ..., description="Pasted raw transcript text", min_length=1, max_length=150000
    )

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Meeting title cannot be empty")
        return clean

    @field_validator("text")
    @classmethod
    def validate_text(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Transcript text cannot be empty or solely whitespace")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "client_id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
                "title": "Q4 Roadmap Review",
                "meeting_date": "2026-10-28",
                "attendees": ["Priya", "Rahul", "Sarah"],
                "text": "Priya: We will finalize the API contract by next Friday.\nRahul: I will review the database models.",
            }
        }
    )


class MeetingResponse(BaseModel):
    """Standard response schema representing a saved meeting."""

    id: str
    client_id: str
    client_name: str | None = None
    title: str
    meeting_date: date | None = None
    source_filename: str | None = None
    attendees: list[str] = Field(default_factory=list)
    created_at: datetime
    line_count: int = 0
    text_length: int = 0

    model_config = ConfigDict(from_attributes=True)


class MeetingDetailResponse(MeetingResponse):
    """Full detail response including the original transcript text and extracted items."""

    raw_text: str
    items: list[ItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MeetingListResponse(BaseModel):
    """List of meetings with pagination metadata."""

    items: list[MeetingResponse]
    total: int
