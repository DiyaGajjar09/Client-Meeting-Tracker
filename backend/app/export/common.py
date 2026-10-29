from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from app.db.models import ItemModel


def sanitize_spreadsheet_value(val: Any) -> Any:
    """Prepend apostrophe to strings starting with formula trigger characters to prevent spreadsheet injection."""
    if val is None:
        return ""
    if isinstance(val, (int, float, date, datetime)):
        return val

    s_val = str(val)
    if s_val and s_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s_val}"
    return s_val


def format_date_display(d: date | datetime | str | None) -> str:
    """Format calendar date unambiguously as DD-MMM-YYYY (e.g. 15-Oct-2026)."""
    if not d:
        return ""
    if isinstance(d, datetime):
        return d.strftime("%d-%b-%Y")
    if isinstance(d, date):
        return d.strftime("%d-%b-%Y")
    if isinstance(d, str):
        try:
            # Handle YYYY-MM-DD
            dt = datetime.strptime(d[:10], "%Y-%m-%d").date()
            return dt.strftime("%d-%b-%Y")
        except ValueError:
            return d
    return str(d)


def generate_safe_export_filename(
    client_name: str | None,
    meeting_title: str | None,
    meeting_date: date | None,
    extension: str,
) -> str:
    """Generate safe, path-traversal-free filename for downloads."""
    c_slug = re.sub(r"[^\w\-]", "_", (client_name or "Client").strip()).strip("_") or "Client"
    m_slug = re.sub(r"[^\w\-]", "_", (meeting_title or "Meeting").strip()).strip("_") or "Meeting"
    d_str = str(meeting_date) if meeting_date else datetime.now().strftime("%Y-%m-%d")
    ext = extension.lstrip(".")
    return f"{c_slug}_{m_slug}_{d_str}.{ext}"


def categorize_meeting_items(
    items: list[ItemModel],
    status_filter: str = "accepted",
) -> dict[str, list[ItemModel]]:
    """Partition items by item_type and apply the specified review status filter."""
    res: dict[str, list[ItemModel]] = {
        "tasks": [],
        "decisions": [],
        "risks": [],
        "open_questions": [],
    }

    for item in items:
        # Check review status filter
        if status_filter == "accepted" and item.review_status != "accepted":
            # For decisions, risks, questions in minutes/json, allow needs_review to be visible if specified
            if item.item_type == "task":
                continue
        elif status_filter == "all_reviewed" and item.review_status not in (
            "accepted",
            "rejected",
            "merged",
        ):
            continue

        if item.item_type == "task":
            res["tasks"].append(item)
        elif item.item_type == "decision":
            res["decisions"].append(item)
        elif item.item_type == "risk":
            res["risks"].append(item)
        elif item.item_type == "open_question":
            res["open_questions"].append(item)

    return res
