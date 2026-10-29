from __future__ import annotations

import io
from datetime import UTC, datetime

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from app.db.models import MeetingModel
from app.export.common import (
    categorize_meeting_items,
    format_date_display,
    sanitize_spreadsheet_value,
)


def build_excel_export(
    meeting: MeetingModel,
    status_filter: str = "accepted",
) -> io.BytesIO:
    """Generate a 5-sheet formatted Excel workbook using openpyxl."""
    wb = openpyxl.Workbook()

    client_name = meeting.client.name if meeting.client else "Client"
    meeting_title = meeting.title
    meeting_date_str = str(meeting.meeting_date) if meeting.meeting_date else "Unspecified"

    items_by_cat = categorize_meeting_items(meeting.items or [], status_filter=status_filter)
    tasks = items_by_cat["tasks"]
    decisions = items_by_cat["decisions"]
    risks = items_by_cat["risks"]
    questions = items_by_cat["open_questions"]

    # Shared Styles
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    amber_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    # -------------------------------------------------------------
    # SHEET 1: Tasks
    # -------------------------------------------------------------
    ws_tasks = wb.active
    ws_tasks.title = "Tasks"

    task_headers = [
        "Task ID",
        "Client",
        "Meeting",
        "Task",
        "Owner",
        "Owner Status",
        "Due Date",
        "Due Date as Said",
        "Priority",
        "Status",
        "Confidence",
        "Evidence",
        "Clarification Needed",
        "Possible Duplicate Of",
    ]
    ws_tasks.append(task_headers)

    for row_idx, item in enumerate(tasks, start=2):
        payload = item.payload_json or {}
        owner_info = payload.get("owner", {})
        owner_name = owner_info.get("name")
        owner_state = owner_info.get("state", "not_stated")

        due_info = payload.get("due", {})
        resolved_date = due_info.get("resolved_date")
        raw_date_wording = due_info.get("raw_text")

        priority = payload.get("priority", "")
        confidence = payload.get("confidence", "medium")

        # Evidence
        evidence_list = payload.get("evidence", [])
        evidence_text = ""
        if evidence_list and isinstance(evidence_list[0], dict):
            ev = evidence_list[0]
            quote = ev.get("quote", "")
            lines = f" (lines {ev.get('line_start')}-{ev.get('line_end')})" if ev.get("line_start") else ""
            evidence_text = f'"{quote}"{lines}'

        # Clarification
        clarifications = payload.get("clarification_needed", [])
        clarification_str = ", ".join(clarifications) if clarifications else ""

        dup_of = item.duplicate_of or ""

        row_data = [
            sanitize_spreadsheet_value(item.id),
            sanitize_spreadsheet_value(client_name),
            sanitize_spreadsheet_value(meeting_title),
            sanitize_spreadsheet_value(payload.get("description", "")),
            sanitize_spreadsheet_value(owner_name if owner_name else "Not stated"),
            sanitize_spreadsheet_value(owner_state),
            format_date_display(resolved_date) if resolved_date else "",
            sanitize_spreadsheet_value(raw_date_wording if raw_date_wording else ""),
            sanitize_spreadsheet_value(priority if priority else ""),
            sanitize_spreadsheet_value(item.review_status),
            sanitize_spreadsheet_value(confidence),
            sanitize_spreadsheet_value(evidence_text),
            sanitize_spreadsheet_value(clarification_str),
            sanitize_spreadsheet_value(dup_of),
        ]
        ws_tasks.append(row_data)

        # Style cells in this row
        is_even = row_idx % 2 == 0
        for col_idx, cell in enumerate(ws_tasks[row_idx], start=1):
            cell.font = Font(name="Calibri", size=10)
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center", wrap_text=(col_idx in (4, 12)))

            if is_even:
                cell.fill = zebra_fill

            # Light amber highlight if owner is missing (col 5)
            if col_idx == 5 and (not owner_name or owner_state == "not_stated"):
                cell.fill = amber_fill
                cell.font = Font(name="Calibri", size=10, italic=True)

            # Light amber highlight if due date is blank (col 7)
            if col_idx == 7 and not resolved_date:
                cell.fill = amber_fill

            # Soft red for low confidence
            if col_idx == 11 and confidence == "low":
                cell.fill = red_fill

    # Status Dropdown Validation on Tasks Sheet
    status_dv = DataValidation(
        type="list",
        formula1='"needs_review,accepted,rejected,merged"',
        allow_blank=True,
    )
    ws_tasks.add_data_validation(status_dv)
    status_dv.add(f"J2:J{max(len(tasks) + 1, 100)}")

    # -------------------------------------------------------------
    # SHEET 2: Decisions
    # -------------------------------------------------------------
    ws_decisions = wb.create_sheet(title="Decisions")
    dec_headers = [
        "Decision ID",
        "Decision Statement",
        "Decided By",
        "Confidence",
        "Evidence",
        "Review Status",
    ]
    ws_decisions.append(dec_headers)

    for row_idx, item in enumerate(decisions, start=2):
        payload = item.payload_json or {}
        evidence_list = payload.get("evidence", [])
        evidence_text = evidence_list[0].get("quote", "") if evidence_list and isinstance(evidence_list[0], dict) else ""
        ws_decisions.append([
            sanitize_spreadsheet_value(item.id),
            sanitize_spreadsheet_value(payload.get("statement", payload.get("description", ""))),
            sanitize_spreadsheet_value(payload.get("decided_by", "Consensus")),
            sanitize_spreadsheet_value(payload.get("confidence", "high")),
            sanitize_spreadsheet_value(evidence_text),
            sanitize_spreadsheet_value(item.review_status),
        ])
        for cell in ws_decisions[row_idx]:
            cell.font = Font(name="Calibri", size=10)
            cell.border = thin_border

    # -------------------------------------------------------------
    # SHEET 3: Risks
    # -------------------------------------------------------------
    ws_risks = wb.create_sheet(title="Risks")
    risk_headers = [
        "Risk ID",
        "Description",
        "Impact",
        "Mitigation",
        "Raised By",
        "Owner",
        "Owner Status",
        "Confidence",
        "Evidence",
        "Review Status",
    ]
    ws_risks.append(risk_headers)

    for row_idx, item in enumerate(risks, start=2):
        payload = item.payload_json or {}
        owner_info = payload.get("owner", {})
        evidence_list = payload.get("evidence", [])
        evidence_text = evidence_list[0].get("quote", "") if evidence_list and isinstance(evidence_list[0], dict) else ""
        ws_risks.append([
            sanitize_spreadsheet_value(item.id),
            sanitize_spreadsheet_value(payload.get("description", "")),
            sanitize_spreadsheet_value(payload.get("impact", "")),
            sanitize_spreadsheet_value(payload.get("mitigation", "")),
            sanitize_spreadsheet_value(payload.get("raised_by", "")),
            sanitize_spreadsheet_value(owner_info.get("name") or "Not stated"),
            sanitize_spreadsheet_value(owner_info.get("state", "not_stated")),
            sanitize_spreadsheet_value(payload.get("confidence", "medium")),
            sanitize_spreadsheet_value(evidence_text),
            sanitize_spreadsheet_value(item.review_status),
        ])
        for cell in ws_risks[row_idx]:
            cell.font = Font(name="Calibri", size=10)
            cell.border = thin_border

    # -------------------------------------------------------------
    # SHEET 4: Open Questions
    # -------------------------------------------------------------
    ws_questions = wb.create_sheet(title="Open Questions")
    question_headers = [
        "Question ID",
        "Question",
        "Asked By",
        "Directed To",
        "Owner State",
        "Needed-by Date",
        "Due-date State",
        "Confidence",
        "Evidence",
        "Review Status",
    ]
    ws_questions.append(question_headers)

    for row_idx, item in enumerate(questions, start=2):
        payload = item.payload_json or {}
        owner_info = payload.get("owner", {})
        due_info = payload.get("due", payload.get("needed_by", {}))
        evidence_list = payload.get("evidence", [])
        evidence_text = evidence_list[0].get("quote", "") if evidence_list and isinstance(evidence_list[0], dict) else ""
        ws_questions.append([
            sanitize_spreadsheet_value(item.id),
            sanitize_spreadsheet_value(payload.get("question", payload.get("description", ""))),
            sanitize_spreadsheet_value(payload.get("asked_by", "")),
            sanitize_spreadsheet_value(owner_info.get("name") or "Unassigned"),
            sanitize_spreadsheet_value(owner_info.get("state", "not_stated")),
            format_date_display(due_info.get("resolved_date")) if due_info.get("resolved_date") else "",
            sanitize_spreadsheet_value(due_info.get("state", "not_stated")),
            sanitize_spreadsheet_value(payload.get("confidence", "medium")),
            sanitize_spreadsheet_value(evidence_text),
            sanitize_spreadsheet_value(item.review_status),
        ])
        for cell in ws_questions[row_idx]:
            cell.font = Font(name="Calibri", size=10)
            cell.border = thin_border

    # -------------------------------------------------------------
    # SHEET 5: README
    # -------------------------------------------------------------
    ws_readme = wb.create_sheet(title="README")
    readme_lines = [
        ("CLIENT MEETING-TO-ACTION TRACKER — EXPORT DOCUMENTATION", ""),
        ("Export Generation Date:", datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")),
        ("Client Organization:", client_name),
        ("Meeting Title:", meeting_title),
        ("Meeting Date:", meeting_date_str),
        ("Inclusion Filter Policy:", f"Items exported with status filter: '{status_filter}'"),
        ("", ""),
        ("DATA CONVENTIONS & UNCERTAINTY POLICIES", ""),
        ("1. Missing Owners:", "Represented strictly as 'Not stated'. The application never fabricates or guesses task owners."),
        ("2. Missing Deadlines:", "Unresolved calendar date cells remain blank. Verbatim phrases (e.g. 'asap', 'by Friday') are recorded under 'Due Date as Said'."),
        ("3. Owner / Date States:", "'stated' = explicitly confirmed in transcript; 'implied' = contextually deduced; 'not_stated' = entirely missing."),
        ("4. Review Statuses:", "'needs_review' = freshly extracted awaiting human approval; 'accepted' = verified for export; 'rejected' = excluded; 'merged' = consolidated."),
        ("5. Confidence Levels:", "'high' = verified with direct verbatim quote; 'medium' = slight paraphrase; 'low' = flagged for human clarification."),
        ("6. Evidence Integrity:", "Every extracted action item references an exact verbatim quote and line bounds from the source transcript."),
    ]
    for r_label, r_desc in readme_lines:
        ws_readme.append([r_label, r_desc])

    ws_readme.column_dimensions["A"].width = 32
    ws_readme.column_dimensions["B"].width = 75
    ws_readme["A1"].font = Font(name="Calibri", size=12, bold=True, color="1E3A8A")
    for r in range(2, len(readme_lines) + 1):
        ws_readme[f"A{r}"].font = Font(name="Calibri", size=10, bold=True)
        ws_readme[f"B{r}"].font = Font(name="Calibri", size=10)

    # -------------------------------------------------------------
    # Format Headers, Freezes, and Filters for Data Sheets
    # -------------------------------------------------------------
    for sheet in [ws_tasks, ws_decisions, ws_risks, ws_questions]:
        # Style Header Row
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        sheet.row_dimensions[1].height = 26
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions

        # Auto-fit Column Widths
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                # limit sample length for wrapping
                max_len = max(max_len, min(len(val), 45))
            sheet.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # Output to in-memory bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
