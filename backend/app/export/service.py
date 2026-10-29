from __future__ import annotations

import io

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import EntityNotFoundError, InvalidInputError
from app.db.models import MeetingModel
from app.export.common import generate_safe_export_filename
from app.export.csv_export import build_csv_export
from app.export.excel import build_excel_export
from app.export.json_export import build_json_export
from app.export.schemas import ExportRequest
from app.export.word import build_word_export


class ExportService:
    """Service orchestrating multi-format exports from persisted meeting records."""

    MIME_TYPES = {
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv; charset=utf-8",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "json": "application/json; charset=utf-8",
    }

    @classmethod
    def generate_export(
        cls,
        db: Session,
        meeting_id: str,
        request: ExportRequest,
    ) -> tuple[io.BytesIO, str, str]:
        """Validate request and generate the requested binary/text export stream."""
        meeting = db.scalar(
            select(MeetingModel)
            .options(
                joinedload(MeetingModel.client),
                joinedload(MeetingModel.items),
            )
            .where(MeetingModel.id == meeting_id)
        )
        if not meeting:
            raise EntityNotFoundError(f"Meeting with ID '{meeting_id}' not found.")

        fmt = request.format.lower()
        if fmt not in cls.MIME_TYPES:
            raise InvalidInputError(f"Unsupported export format '{request.format}'.")

        client_name = meeting.client.name if meeting.client else "Client"
        filename = generate_safe_export_filename(
            client_name=client_name,
            meeting_title=meeting.title,
            meeting_date=meeting.meeting_date,
            extension=fmt,
        )
        media_type = cls.MIME_TYPES[fmt]

        if fmt == "xlsx":
            stream = build_excel_export(
                meeting=meeting,
                status_filter=request.status_filter,
            )
        elif fmt == "csv":
            stream = build_csv_export(
                meeting=meeting,
                column_mapping=request.column_mapping,
                status_filter=request.status_filter,
            )
        elif fmt == "docx":
            stream = build_word_export(
                meeting=meeting,
                reviewer_name=request.reviewer_name,
                status_filter=request.status_filter,
            )
        elif fmt == "json":
            stream = build_json_export(
                meeting=meeting,
                status_filter=request.status_filter,
                include_transcript=request.include_transcript,
            )
        else:
            raise InvalidInputError(f"Unknown format handler for '{fmt}'.")

        return stream, filename, media_type

