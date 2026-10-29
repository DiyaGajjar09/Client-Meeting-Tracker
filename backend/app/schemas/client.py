from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClientCreate(BaseModel):
    """Request schema for creating a new client organization."""

    name: str = Field(
        ...,
        description="Organization or client company name",
        min_length=1,
        max_length=255,
    )

    @field_validator("name")
    @classmethod
    def clean_client_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Client name cannot be empty or solely whitespace")
        return cleaned

    model_config = ConfigDict(json_schema_extra={"example": {"name": "Acme Corporation"}})


class ClientResponse(BaseModel):
    """Response schema for client information."""

    id: str
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientListResponse(BaseModel):
    """Paginated or complete list of clients."""

    items: list[ClientResponse]
    total: int
