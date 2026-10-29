from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.item_repository import ItemRepository
from app.schemas.item import (
    ItemListResponse,
    ItemMergeRequest,
    ItemMergeResponse,
    ItemResponse,
    ItemSplitRequest,
    ItemSplitResponse,
    ItemUpdate,
)
from app.schemas.review import ReviewEventResponse
from app.services.item_service import ItemService

router = APIRouter(prefix="/items", tags=["Review Items"])


@router.get(
    "",
    response_model=ItemListResponse,
    status_code=status.HTTP_200_OK,
    summary="List extracted items with optional filters",
)
def list_items(
    meeting_id: str | None = Query(None, description="Filter items by meeting ID"),
    item_type: str | None = Query(
        None, description="Filter by item type (task, decision, risk, open_question)"
    ),
    review_status: str | None = Query(
        None, description="Filter by status (needs_review, accepted, rejected, merged)"
    ),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(100, ge=1, le=500, description="Page limit"),
    db: Session = Depends(get_db),
):
    """Retrieve items matching criteria."""
    items, total = ItemService.list_items(
        db,
        meeting_id=meeting_id,
        item_type=item_type,
        review_status=review_status,
        skip=skip,
        limit=limit,
    )
    return ItemListResponse(items=items, total=total)


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve single item by ID",
)
def get_item(
    item_id: str,
    db: Session = Depends(get_db),
):
    """Get single action item details."""
    return ItemService.get_item(db, item_id=item_id)


@router.patch(
    "/{item_id}",
    response_model=ItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update item review status or payload (inline edit, accept, reject)",
)
def update_item(
    item_id: str,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
):
    """Update item and record an immutable review event."""
    return ItemService.update_item(db, item_id=item_id, update_in=payload)


@router.post(
    "/{item_id}/merge",
    response_model=ItemMergeResponse,
    status_code=status.HTTP_200_OK,
    summary="Merge source item into canonical item",
)
def merge_items(
    item_id: str,
    payload: ItemMergeRequest,
    db: Session = Depends(get_db),
):
    """Consolidate source item into canonical item, preserving evidence and audit history."""
    return ItemService.merge_items(db, canonical_id=item_id, merge_in=payload)


@router.post(
    "/{item_id}/split",
    response_model=ItemSplitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Split item into two distinct sub-items",
)
def split_item(
    item_id: str,
    payload: ItemSplitRequest,
    db: Session = Depends(get_db),
):
    """Split an item into two distinct sub-items with unique IDs in a database transaction."""
    return ItemService.split_item(db, item_id=item_id, split_in=payload)


@router.get(
    "/{item_id}/events",
    response_model=list[ReviewEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Retrieve audit review history for an item",
)
def get_item_events(
    item_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve all recorded review audit events for this action item."""
    return ItemRepository.list_review_events(db, item_id=item_id)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an item",
)
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
):
    """Permanently delete an item."""
    ItemService.delete_item(db, item_id=item_id)
    return None
