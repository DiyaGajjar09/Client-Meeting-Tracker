from pydantic import BaseModel, ConfigDict, Field, field_validator


class ColumnMappingItem(BaseModel):
    """Configuration for an individual exportable column."""

    id: str = Field(..., description="Field identifier e.g. 'description', 'owner', 'dueDate'")
    label: str = Field(..., description="Export header display label")
    selected: bool = Field(True, description="Whether this column is included in export")

    model_config = ConfigDict(extra="ignore")


class ExportRequest(BaseModel):
    """Request payload to generate a downloadable export file."""

    format: str = Field(..., description="Export format: 'xlsx', 'csv', 'docx', or 'json'")
    status_filter: str = Field(
        "accepted",
        description="Filter items: 'accepted' (default tracker), 'all_reviewed' (accepted & rejected), or 'all'",
    )
    column_mapping: list[ColumnMappingItem] | None = Field(
        None, description="Custom column selection, renaming, and ordering for spreadsheet exports"
    )
    reviewer_name: str | None = Field(
        None, description="Reviewer name to appear in document footer (Word .docx)"
    )
    include_transcript: bool = Field(
        False, description="Whether to include full raw transcript in JSON export"
    )

    @field_validator("format")
    @classmethod
    def validate_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("xlsx", "csv", "docx", "json"):
            raise ValueError("Supported export formats are: 'xlsx', 'csv', 'docx', 'json'")
        return clean

    @field_validator("status_filter")
    @classmethod
    def validate_status_filter(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("accepted", "all_reviewed", "all"):
            raise ValueError("Supported status filters are: 'accepted', 'all_reviewed', 'all'")
        return clean

    model_config = ConfigDict(extra="forbid")

