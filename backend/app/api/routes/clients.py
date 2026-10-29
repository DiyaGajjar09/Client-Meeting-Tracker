from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.client import ClientCreate, ClientListResponse, ClientResponse
from app.schemas.review import ClarificationListResponse
from app.services.clarification_service import ClarificationService
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post(
    "",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new client organization",
)
def create_client(
    client_in: ClientCreate,
    db: Session = Depends(get_db),
):
    """Register a new client company or organization.

    Prevents duplicate names after normalization.
    """
    return MeetingService.create_client(db=db, client_in=client_in)


@router.get(
    "",
    response_model=ClientListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all client organizations",
)
def list_clients(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(100, ge=1, le=500, description="Page limit"),
    db: Session = Depends(get_db),
):
    """Retrieve all clients ordered alphabetically by organization name."""
    items, total = MeetingService.list_clients(db=db, skip=skip, limit=limit)
    return ClientListResponse(items=items, total=total)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single client by ID",
)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific client organization."""
    return MeetingService.get_client(db=db, client_id=client_id)


@router.get(
    "/{client_id}/open-items",
    response_model=ClarificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve unresolved items needing clarification for a client",
)
def get_client_open_items(
    client_id: str,
    meeting_id: str | None = Query(None, description="Filter by specific meeting ID"),
    item_type: str | None = Query(None, description="Filter by item type (task, risk, open_question)"),
    review_status: str | None = Query(None, description="Filter by review status"),
    db: Session = Depends(get_db),
):
    """Identify action items with missing information or open uncertainty and generate deterministic follow-up questions."""
    return ClarificationService.get_client_open_items(
        db=db,
        client_id=client_id,
        meeting_id=meeting_id,
        item_type=item_type,
        review_status=review_status,
    )


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete client organization",
)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
):
    """Permanently delete a client organization and cascade delete associated records."""
    MeetingService.delete_client(db=db, client_id=client_id)
    return None
