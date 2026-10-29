from __future__ import annotations

import io
import json
from datetime import UTC, datetime

from app.db.models import MeetingModel
from app.export.common import categorize_meeting_items


def build_json_export(
    meeting: MeetingModel,
    status_filter: str = "all",
    include_transcript: bool = False,
) -> io.BytesIO:
    """Generate a clean, schema-versioned JSON export with uncertainty preservation."""
    items_by_cat = categorize_meeting_items(meeting.items or [], status_filter=status_filter)

    client_data = {
        "id": meeting.client.id if meeting.client else None,
        "name": meeting.client.name if meeting.client else None,
    }

    meeting_data = {
        "id": meeting.id,
        "title": meeting.title,
        "meeting_date": str(meeting.meeting_date) if meeting.meeting_date else None,
        "attendees": meeting.attendees or [],
        "source_filename": meeting.source_filename,
        "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
    }

    if include_transcript:
        meeting_data["raw_text"] = meeting.raw_text

    # Tasks serialization
    serialized_tasks = []
    for it in items_by_cat["tasks"]:
        payload = it.payload_json or {}
        owner_info = payload.get("owner", {})
        due_info = payload.get("due", {})
        serialized_tasks.append({
            "id": it.id,
            "description": payload.get("description", ""),
            "owner": {
                "name": owner_info.get("name"),  # strictly null if not stated
                "state": owner_info.get("state", "not_stated"),
            },
            "due_date": {
                "resolved_date": str(due_info.get("resolved_date")) if due_info.get("resolved_date") else None,
                "raw_text": due_info.get("raw_text"),
                "state": due_info.get("state", "not_stated"),
            },
            "priority": payload.get("priority"),
            "confidence": payload.get("confidence", "medium"),
            "review_status": it.review_status,
            "edited_by_human": it.edited_by_human,
            "duplicate_of": it.duplicate_of,
            "evidence": payload.get("evidence", []),
            "clarification_needed": payload.get("clarification_needed", []),
        })

    # Decisions serialization
    serialized_decisions = []
    for it in items_by_cat["decisions"]:
        payload = it.payload_json or {}
        serialized_decisions.append({
            "id": it.id,
            "statement": payload.get("statement", payload.get("description", "")),
            "decided_by": payload.get("decided_by", "Consensus"),
            "confidence": payload.get("confidence", "high"),
            "review_status": it.review_status,
            "evidence": payload.get("evidence", []),
        })

    # Risks serialization
    serialized_risks = []
    for it in items_by_cat["risks"]:
        payload = it.payload_json or {}
        owner_info = payload.get("owner", {})
        serialized_risks.append({
            "id": it.id,
            "description": payload.get("description", ""),
            "impact": payload.get("impact"),
            "mitigation": payload.get("mitigation"),
            "owner": {
                "name": owner_info.get("name"),
                "state": owner_info.get("state", "not_stated"),
            },
            "confidence": payload.get("confidence", "medium"),
            "review_status": it.review_status,
            "evidence": payload.get("evidence", []),
        })

    # Questions serialization
    serialized_questions = []
    for it in items_by_cat["open_questions"]:
        payload = it.payload_json or {}
        owner_info = payload.get("owner", {})
        due_info = payload.get("due", payload.get("needed_by", {}))
        serialized_questions.append({
            "id": it.id,
            "question": payload.get("question", payload.get("description", "")),
            "asked_by": payload.get("asked_by"),
            "directed_to": owner_info.get("name"),
            "needed_by": {
                "resolved_date": str(due_info.get("resolved_date")) if due_info.get("resolved_date") else None,
                "state": due_info.get("state", "not_stated"),
            },
            "confidence": payload.get("confidence", "medium"),
            "review_status": it.review_status,
            "evidence": payload.get("evidence", []),
        })

    document = {
        "schema_version": "1.0",
        "exported_at": datetime.now(UTC).isoformat(),
        "status_filter_applied": status_filter,
        "client": client_data,
        "meeting": meeting_data,
        "summary": {
            "total_tasks": len(serialized_tasks),
            "total_decisions": len(serialized_decisions),
            "total_risks": len(serialized_risks),
            "total_open_questions": len(serialized_questions),
        },
        "tasks": serialized_tasks,
        "decisions": serialized_decisions,
        "risks": serialized_risks,
        "open_questions": serialized_questions,
    }

    json_str = json.dumps(document, indent=2, ensure_ascii=False)
    return io.BytesIO(json_str.encode("utf-8"))


def build_json_dict(
    meeting: MeetingModel,
    status_filter: str = "all",
    include_transcript: bool = False,
) -> dict:
    """Return JSON export document as a Python dict."""
    stream = build_json_export(
        meeting=meeting,
        status_filter=status_filter,
        include_transcript=include_transcript,
    )
    return json.loads(stream.getvalue().decode("utf-8"))
