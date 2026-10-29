from __future__ import annotations

import csv
import io

from app.db.models import MeetingModel
from app.export.common import (
    categorize_meeting_items,
    format_date_display,
    sanitize_spreadsheet_value,
)
from app.export.schemas import ColumnMappingItem

DEFAULT_CSV_COLUMNS: list[ColumnMappingItem] = [
    ColumnMappingItem(id="id", label="Task ID", selected=True),
    ColumnMappingItem(id="client", label="Client", selected=True),
    ColumnMappingItem(id="meeting", label="Meeting", selected=True),
    ColumnMappingItem(id="description", label="Task", selected=True),
    ColumnMappingItem(id="owner", label="Owner", selected=True),
    ColumnMappingItem(id="owner_state", label="Owner Status", selected=True),
    ColumnMappingItem(id="due_date", label="Due Date", selected=True),
    ColumnMappingItem(id="raw_date_wording", label="Due Date as Said", selected=True),
    ColumnMappingItem(id="priority", label="Priority", selected=True),
    ColumnMappingItem(id="status", label="Status", selected=True),
    ColumnMappingItem(id="confidence", label="Confidence", selected=True),
    ColumnMappingItem(id="evidence", label="Evidence", selected=True),
    ColumnMappingItem(id="clarification_needed", label="Clarification Needed", selected=True),
    ColumnMappingItem(id="duplicate_of", label="Possible Duplicate Of", selected=True),
]


def extract_task_field_value(
    item_id: str,
    client_name: str,
    meeting_title: str,
    payload: dict,
    review_status: str,
    duplicate_of: str | None,
    col_id: str,
) -> str:
    """Extract and format a single field value for CSV export."""
    owner_info = payload.get("owner", {})
    owner_name = owner_info.get("name")
    owner_state = owner_info.get("state", "not_stated")

    due_info = payload.get("due", {})
    resolved_date = due_info.get("resolved_date")
    raw_date = due_info.get("raw_text")

    if col_id in ("id", "task_id"):
        return item_id
    elif col_id in ("client", "client_name"):
        return client_name
    elif col_id in ("meeting", "meeting_title"):
        return meeting_title
    elif col_id in ("description", "task"):
        return payload.get("description", "")
    elif col_id in ("owner", "assignee"):
        return owner_name if owner_name else "Not stated"
    elif col_id in ("owner_state", "owner_status"):
        return owner_state
    elif col_id in ("due_date", "dueDate"):
        return format_date_display(resolved_date) if resolved_date else ""
    elif col_id in ("raw_date_wording", "rawDateWording", "due_date_as_said"):
        return raw_date if raw_date else ""
    elif col_id == "priority":
        return payload.get("priority", "")
    elif col_id in ("status", "review_status", "reviewStatus"):
        return review_status
    elif col_id == "confidence":
        return payload.get("confidence", "medium")
    elif col_id in ("evidence", "evidenceQuote"):
        evidence_list = payload.get("evidence", [])
        if evidence_list and isinstance(evidence_list[0], dict):
            ev = evidence_list[0]
            lines = f" (lines {ev.get('line_start')}-{ev.get('line_end')})" if ev.get("line_start") else ""
            return f'"{ev.get("quote", "")}"{lines}'
        return ""
    elif col_id in ("clarification_needed", "clarificationNeeded"):
        clarifications = payload.get("clarification_needed", [])
        return ", ".join(clarifications) if clarifications else ""
    elif col_id in ("duplicate_of", "possibleDuplicateOf"):
        return duplicate_of or ""
    return str(payload.get(col_id, ""))


def build_csv_export(
    meeting: MeetingModel,
    column_mapping: list[ColumnMappingItem] | None = None,
    status_filter: str = "accepted",
) -> io.BytesIO:
    """Generate a clean, UTF-8 encoded CSV export with formula injection safeguards."""
    client_name = meeting.client.name if meeting.client else "Client"
    meeting_title = meeting.title

    items_by_cat = categorize_meeting_items(meeting.items or [], status_filter=status_filter)
    tasks = items_by_cat["tasks"]

    # Determine active columns
    active_cols = [c for c in (column_mapping or DEFAULT_CSV_COLUMNS) if c.selected]
    if not active_cols:
        active_cols = DEFAULT_CSV_COLUMNS

    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)

    # Write Header
    writer.writerow([c.label for c in active_cols])

    # Write Rows
    for item in tasks:
        payload = item.payload_json or {}
        row = []
        for col in active_cols:
            raw_val = extract_task_field_value(
                item_id=item.id,
                client_name=client_name,
                meeting_title=meeting_title,
                payload=payload,
                review_status=item.review_status,
                duplicate_of=item.duplicate_of,
                col_id=col.id,
            )
            # Apply formula injection defense
            safe_val = sanitize_spreadsheet_value(raw_val)
            row.append(safe_val)
        writer.writerow(row)

    # Encode as UTF-8 with BOM (utf-8-sig) for universal spreadsheet compatibility
    encoded = buffer.getvalue().encode("utf-8-sig")
    return io.BytesIO(encoded)

