from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import EntityNotFoundError
from app.db.models import ClientModel, ItemModel, MeetingModel
from app.schemas.review import ClarificationItemResponse, ClarificationListResponse


class ClarificationService:
    """Service generating deterministic follow-up questions for unresolved client items."""

    @staticmethod
    def get_client_open_items(
        db: Session,
        client_id: str,
        meeting_id: str | None = None,
        item_type: str | None = None,
        review_status: str | None = None,
    ) -> ClarificationListResponse:
        """Find action items with missing information or open status and generate template questions."""
        client = db.scalar(select(ClientModel).where(ClientModel.id == client_id))
        if not client:
            raise EntityNotFoundError(f"Client organization with ID '{client_id}' not found.")

        # Query all candidate items for this client
        stmt = (
            select(ItemModel)
            .join(MeetingModel, ItemModel.meeting_id == MeetingModel.id)
            .options(joinedload(ItemModel.meeting))
            .where(
                MeetingModel.client_id == client_id,
            )
        )
        if meeting_id:
            stmt = stmt.where(ItemModel.meeting_id == meeting_id)
        if item_type:
            stmt = stmt.where(ItemModel.item_type == item_type)
        if review_status:
            stmt = stmt.where(ItemModel.review_status == review_status)
        else:
            # By default exclude rejected and merged items
            stmt = stmt.where(ItemModel.review_status.notin_(["rejected", "merged"]))

        items = list(db.scalars(stmt).all())
        clarification_items: list[ClarificationItemResponse] = []

        for it in items:
            payload = it.payload_json or {}
            desc = (
                payload.get("description")
                or payload.get("statement")
                or payload.get("question")
                or ""
            )
            owner_info = payload.get("owner", {})
            owner_name = owner_info.get("name")
            owner_state = owner_info.get("state", "not_stated")

            due_info = payload.get("due", {})
            resolved_date = due_info.get("resolved_date")
            due_state = due_info.get("state", "not_stated")
            confidence = payload.get("confidence", "medium")

            evidence_list = payload.get("evidence", [])
            evidence_quotes = [
                e.get("quote") for e in evidence_list if isinstance(e, dict) and e.get("quote")
            ]

            missing_fields: list[str] = []
            questions: list[str] = []

            is_task = it.item_type == "task"
            is_question = it.item_type == "open_question"
            is_risk = it.item_type == "risk"

            # 1. Missing or Ambiguous Owner
            if is_task and (not owner_name or owner_state in ("not_stated", "implied")):
                missing_fields.append("owner")

            # 2. Missing or Relative Due Date
            if is_task and (not resolved_date or due_state in ("not_stated", "relative")):
                missing_fields.append("deadline")

            # 3. Low confidence
            if confidence == "low":
                missing_fields.append("confidence")

            # 4. Open question
            if is_question:
                missing_fields.append("answer")

            # 5. Risk
            if is_risk:
                missing_fields.append("mitigation")

            # If no uncertainty and it's already accepted, don't flag
            if not missing_fields and it.review_status == "accepted":
                continue

            # Deterministic template-based questions (PRD: Zero AI call needed for deterministic questions)
            if "owner" in missing_fields and "deadline" in missing_fields:
                questions.append(
                    f"Who is responsible and what is the deadline for completing this task: \"{desc}\"?"
                )
            elif "owner" in missing_fields:
                questions.append(
                    f"Who is responsible for completing this task: \"{desc}\"?"
                )
            elif "deadline" in missing_fields:
                questions.append(
                    f"What is the target deadline for: \"{desc}\"?"
                )

            if is_question:
                questions.append(
                    f"Who can confirm the resolution or expected outcome for: \"{desc}\"?"
                )

            if is_risk:
                questions.append(
                    f"What mitigation strategy or contingency plan should be put in place for: \"{desc}\"?"
                )

            if confidence == "low" and not questions:
                questions.append(
                    f"Can someone verify that the following item was formally agreed upon: \"{desc}\"?"
                )

            clarification_items.append(
                ClarificationItemResponse(
                    id=it.id,
                    meeting_id=it.meeting_id,
                    meeting_title=it.meeting.title if it.meeting else "",
                    meeting_date=str(it.meeting.meeting_date)
                    if it.meeting and it.meeting.meeting_date
                    else None,
                    item_type=it.item_type,
                    description=desc,
                    owner_name=owner_name,
                    owner_state=owner_state,
                    resolved_date=str(resolved_date) if resolved_date else None,
                    due_date_state=due_state,
                    confidence=confidence,
                    missing_fields=missing_fields,
                    evidence_quotes=evidence_quotes,
                    suggested_questions=questions,
                )
            )

        return ClarificationListResponse(
            client_id=client.id,
            client_name=client.name,
            items=clarification_items,
            total=len(clarification_items),
        )

