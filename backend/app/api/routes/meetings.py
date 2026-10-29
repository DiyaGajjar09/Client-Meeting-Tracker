import json
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import EntityNotFoundError, InvalidInputError
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.export.schemas import ExportRequest
from app.export.service import ExportService
from app.schemas.extraction import ExtractionRunResponse, ExtractMeetingRequest
from app.schemas.item import ItemResponse
from app.schemas.meeting import (
    MeetingCreateJson,
    MeetingDetailResponse,
    MeetingResponse,
)
from app.schemas.review import (
    DuplicateCandidateResponse,
    DuplicateResolveRequest,
    DuplicateResolveResponse,
    MeetingHistoryResponse,
)
from app.services.item_service import ItemService
from app.services.meeting_service import MeetingService
from app.services.pipeline import ExtractionPipeline
from app.similarity.deduplication import DeduplicationService

router = APIRouter(prefix="/meetings", tags=["Meetings"])


def _parse_attendees_string(raw: str | None) -> list[str]:
    """Parse comma-separated or JSON list of attendees."""
    if not raw:
        return []
    stripped = raw.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return [str(a).strip() for a in parsed if str(a).strip()]
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    # Fallback to comma-separated
    return [part.strip() for part in stripped.split(",") if part.strip()]


@router.post(
    "",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create meeting via multipart/form-data (pasted text or file upload)",
    dependencies=[Depends(rate_limit("meetings_create", lambda: settings.RATE_LIMIT_MEETINGS))],
)
async def create_meeting_form(
    client_id: str = Form(..., description="ID of existing client organization"),
    title: str = Form(..., description="Meeting title or description"),
    meeting_date: date | None = Form(None, description="Date of meeting (YYYY-MM-DD)"),
    attendees: str | None = Form(
        None, description="Comma-separated or JSON list of participant names"
    ),
    text: str | None = Form(None, description="Pasted raw transcript text (up to 150k chars)"),
    file: UploadFile | None = File(
        None,
        description="Uploaded transcript file (.txt, .docx, .pdf, .vtt, .srt up to 10MB)",
    ),
    db: Session = Depends(get_db),
):
    """Multipart endpoint to create a meeting by uploading a file or pasting transcript text.

    Validates file format, size limits, and speaker turns.
    """
    attendee_list = _parse_attendees_string(attendees)

    if not text and not file:
        raise InvalidInputError("Either 'text' or an uploaded 'file' must be provided.")

    if file and file.filename:
        file_bytes = await file.read()
        return MeetingService.create_meeting_from_upload(
            db=db,
            client_id=client_id,
            title=title,
            filename=file.filename,
            file_bytes=file_bytes,
            meeting_date=meeting_date,
            attendees=attendee_list,
        )
    elif text:
        return MeetingService.create_meeting_from_text(
            db=db,
            client_id=client_id,
            title=title,
            text=text,
            meeting_date=meeting_date,
            attendees=attendee_list,
        )
    else:
        raise InvalidInputError("No readable transcript text or valid file received.")


@router.post(
    "/json",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create meeting from JSON body (pasted text only)",
    dependencies=[Depends(rate_limit("meetings_create", lambda: settings.RATE_LIMIT_MEETINGS))],
)
def create_meeting_json(
    payload: MeetingCreateJson,
    db: Session = Depends(get_db),
):
    """Convenience JSON endpoint to create a meeting directly with pasted text."""
    return MeetingService.create_meeting_from_text(
        db=db,
        client_id=payload.client_id,
        title=payload.title,
        text=payload.text,
        meeting_date=payload.meeting_date,
        attendees=payload.attendees,
    )


@router.get(
    "",
    response_model=MeetingHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="List meetings with search, client/date filters, sorting, and review counts",
)
def list_meetings(
    client_id: str | None = Query(None, description="Filter meetings by client ID"),
    search: str | None = Query(None, description="Search by meeting title or client name"),
    start_date: date | None = Query(None, description="Filter meetings on or after this date"),
    end_date: date | None = Query(None, description="Filter meetings on or before this date"),
    sort_by: str = Query("meeting_date", description="Sort by 'meeting_date', 'created_at', or 'title'"),
    sort_order: str = Query("desc", description="Sort order 'desc' or 'asc'"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(50, ge=1, le=500, description="Page limit"),
    db: Session = Depends(get_db),
):
    """Retrieve saved meetings with database-level filtering, pagination, and review status item counts."""
    items, total = MeetingService.list_meetings(
        db=db,
        client_id=client_id,
        search=search,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    page_num = (skip // limit) + 1 if limit > 0 else 1
    return MeetingHistoryResponse(items=items, total=total, page=page_num, page_size=limit)


@router.get(
    "/{meeting_id}",
    response_model=MeetingDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get single meeting by ID",
)
def get_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve meeting metadata and the stored transcript text."""
    return MeetingService.get_meeting(db=db, meeting_id=meeting_id)


@router.delete(
    "/{meeting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete meeting transcript and related items",
)
def delete_meeting(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    """Permanently delete a meeting transcript and all cascading items, runs, and review history."""
    MeetingService.delete_meeting(db=db, meeting_id=meeting_id)
    return None


@router.get(
    "/{meeting_id}/items",
    response_model=list[ItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all extracted action items for a meeting",
)
def get_meeting_items(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve action items belonging to the specified meeting."""
    items, _ = ItemService.list_items(db=db, meeting_id=meeting_id, limit=500)
    return items


@router.get(
    "/{meeting_id}/duplicates",
    response_model=list[DuplicateCandidateResponse],
    status_code=status.HTTP_200_OK,
    summary="Detect potential duplicate tasks across earlier meetings for the same client",
)
def get_meeting_duplicates(
    meeting_id: str,
    threshold: float | None = Query(
        None, ge=0.0, le=1.0, description="Minimum similarity score threshold (default 0.60)"
    ),
    db: Session = Depends(get_db),
):
    """Find candidate duplicate tasks using scikit-learn TF-IDF and cosine similarity within client history."""
    return DeduplicationService.get_meeting_duplicates(
        db=db,
        meeting_id=meeting_id,
        threshold=threshold,
    )


@router.post(
    "/{meeting_id}/duplicates/resolve",
    response_model=DuplicateResolveResponse,
    status_code=status.HTTP_200_OK,
    summary="Resolve a duplicate suggestion (keep both, merge, discard)",
)
def resolve_duplicate(
    meeting_id: str,
    payload: DuplicateResolveRequest,
    db: Session = Depends(get_db),
):
    """Record reviewer resolution for a duplicate pair without deleting original source records."""
    meeting = MeetingService.get_meeting(db=db, meeting_id=meeting_id)
    if not meeting:
        raise EntityNotFoundError(f"Meeting '{meeting_id}' not found.")
    return ItemService.resolve_duplicate(
        db=db,
        client_id=meeting.client_id,
        resolve_in=payload,
    )


@router.post(
    "/{meeting_id}/extract",
    response_model=ExtractionRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Trigger AI extraction pipeline on meeting transcript",
    dependencies=[Depends(rate_limit("meetings_extract", lambda: settings.RATE_LIMIT_EXTRACT))],
)
def extract_meeting(
    meeting_id: str,
    payload: ExtractMeetingRequest = ExtractMeetingRequest(),
    db: Session = Depends(get_db),
):
    """Run chunking, Gemini LLM extraction, deterministic verification, and persistence."""
    pipeline = ExtractionPipeline()
    return pipeline.run(
        db=db,
        meeting_id=meeting_id,
        policy=payload.policy,
        custom_model=payload.custom_model,
    )


@router.post(
    "/{meeting_id}/export",
    status_code=status.HTTP_200_OK,
    summary="Generate and download reviewed meeting records in specified format (.xlsx, .csv, .docx, .json)",
    response_description="Binary file stream with safe Content-Disposition attachment header",
    dependencies=[Depends(rate_limit("meetings_export", lambda: settings.RATE_LIMIT_EXPORT))],
)
def export_meeting(
    meeting_id: str,
    payload: ExportRequest,
    db: Session = Depends(get_db),
):
    """Generate real downloadable export file (.xlsx, .csv, .docx, or .json) from persisted MySQL records."""
    stream, filename, media_type = ExportService.generate_export(
        db=db,
        meeting_id=meeting_id,
        request=payload,
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return StreamingResponse(
        stream,
        media_type=media_type,
        headers=headers,
    )


@router.post(
    "/retention/cleanup",
    status_code=status.HTTP_200_OK,
    summary="Purge expired meetings per data retention policy (default 90 days)",
)
def cleanup_retention(
    retention_days: int | None = None,
    db: Session = Depends(get_db),
):
    """Enforce data retention by deleting meeting transcripts, items, and audit records older than threshold."""
    deleted_count = MeetingService.cleanup_expired_meetings(db=db, retention_days=retention_days)
    return {
        "status": "success",
        "deleted_count": deleted_count,
        "retention_days": retention_days or settings.RETENTION_DAYS,
    }
