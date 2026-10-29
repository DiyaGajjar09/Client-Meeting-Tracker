import time
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    AIProviderError,
    EntityNotFoundError,
    ExtractionValidationError,
)
from app.core.logging import logger
from app.db.models import ItemModel, RunModel
from app.ingestion.speakers import process_transcript_lines
from app.llm import LLMClient, get_llm_client
from app.llm.prompts.system_prompts import (
    CHUNK_EXTRACTION_USER_PROMPT,
    EXTRACTION_SYSTEM_PROMPT,
)
from app.repositories.meeting_repository import MeetingRepository
from app.schemas.common import (
    Confidence,
    DecisionPayload,
    OpenQuestionPayload,
    RiskPayload,
    TaskPayload,
)
from app.schemas.extraction import (
    ExtractionRunResponse,
    MeetingExtractionResult,
    ReExtractionPolicy,
)
from app.schemas.item import ItemResponse
from app.verify.dates import verify_due_date
from app.verify.evidence import compute_similarity_ratio, verify_evidence_quotes
from app.verify.owners import verify_owner
from app.verify.reversals import apply_reversals_and_cancellations


class ExtractionPipeline:
    """End-to-end pipeline orchestrating chunking, LLM extraction, verification, and persistence."""

    def __init__(self, llm_client: LLMClient | None = None):
        self.llm_client = llm_client

    def _get_client(self, custom_model: str | None = None) -> LLMClient:
        if self.llm_client:
            return self.llm_client
        return get_llm_client(custom_model=custom_model)

    def chunk_transcript(
        self,
        indexed_lines: list[tuple[int, str]],
        client: LLMClient,
        target_tokens: int = 6000,
        overlap_tokens: int = 500,
    ) -> list[str]:
        """Split transcript into overlapping chunks at speaker turns or line boundaries."""
        if not indexed_lines:
            return []

        formatted_lines = [f"L{num}: {text}" for num, text in indexed_lines]
        full_text = "\n".join(formatted_lines)
        total_tokens = client.count_tokens(full_text)

        # Single chunk for short/medium transcripts
        if total_tokens <= target_tokens:
            return [full_text]

        chunks: list[str] = []
        current_chunk_lines: list[str] = []
        current_tokens = 0

        idx = 0
        while idx < len(formatted_lines):
            line = formatted_lines[idx]
            line_tokens = client.count_tokens(line)

            if current_tokens + line_tokens > target_tokens and current_chunk_lines:
                chunks.append("\n".join(current_chunk_lines))

                # Backtrack for overlap
                overlap_count = 0
                backtrack_lines: list[str] = []
                for prev_line in reversed(current_chunk_lines):
                    prev_tokens = client.count_tokens(prev_line)
                    if overlap_count + prev_tokens > overlap_tokens:
                        break
                    overlap_count += prev_tokens
                    backtrack_lines.insert(0, prev_line)

                current_chunk_lines = backtrack_lines
                current_tokens = overlap_count

            current_chunk_lines.append(line)
            current_tokens += line_tokens
            idx += 1

        if current_chunk_lines:
            chunks.append("\n".join(current_chunk_lines))

        return chunks

    def _extract_chunk_with_retry(
        self,
        client: LLMClient,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 2,
    ) -> tuple[MeetingExtractionResult, int | None, int | None]:
        """Extract structured data with up to max_retries on validation failure."""
        total_tokens_in = 0
        total_tokens_out = 0
        last_error = None
        attempt_prompt = user_prompt

        for attempt in range(max_retries + 1):
            try:
                raw_json, tin, tout = client.extract_structured(
                    system_prompt=system_prompt,
                    user_prompt=attempt_prompt,
                    response_model=MeetingExtractionResult,
                )
                if tin:
                    total_tokens_in += tin
                if tout:
                    total_tokens_out += tout

                # Validate with Pydantic v2
                parsed = MeetingExtractionResult.model_validate(raw_json)
                return parsed, total_tokens_in, total_tokens_out
            except (ValidationError, AIProviderError) as exc:
                last_error = exc
                logger.warning(
                    f"Extraction validation failure on attempt {attempt+1}/{max_retries+1}: {exc}"
                )
                if attempt < max_retries:
                    # Provide targeted correction context for retry
                    attempt_prompt = (
                        f"{user_prompt}\n\n"
                        f"CORRECTION NOTE: Previous extraction failed with validation error: {exc!s}. "
                        f"Please ensure all required fields match the schema exactly and zero hallucination rules are respected."
                    )

        raise ExtractionValidationError(
            f"Extraction failed after {max_retries+1} attempts: {last_error}",
            detail=str(last_error),
        )

    def _deduplicate_items(
        self,
        tasks: list[TaskPayload],
        decisions: list[DecisionPayload],
        risks: list[RiskPayload],
        questions: list[OpenQuestionPayload],
    ) -> tuple[
        list[TaskPayload],
        list[DecisionPayload],
        list[RiskPayload],
        list[OpenQuestionPayload],
    ]:
        """Merge duplicate items resulting from overlapping chunks."""
        deduped_tasks: list[TaskPayload] = []
        for t in tasks:
            is_dup = any(
                compute_similarity_ratio(t.description, existing.description) >= 0.85
                for existing in deduped_tasks
            )
            if not is_dup:
                deduped_tasks.append(t)

        deduped_decisions: list[DecisionPayload] = []
        for d in decisions:
            is_dup = any(
                compute_similarity_ratio(d.statement, existing.statement) >= 0.85
                for existing in deduped_decisions
            )
            if not is_dup:
                deduped_decisions.append(d)

        deduped_risks: list[RiskPayload] = []
        for r in risks:
            is_dup = any(
                compute_similarity_ratio(r.description, existing.description) >= 0.85
                for existing in deduped_risks
            )
            if not is_dup:
                deduped_risks.append(r)

        deduped_questions: list[OpenQuestionPayload] = []
        for q in questions:
            is_dup = any(
                compute_similarity_ratio(q.question, existing.question) >= 0.85
                for existing in deduped_questions
            )
            if not is_dup:
                deduped_questions.append(q)

        return deduped_tasks, deduped_decisions, deduped_risks, deduped_questions

    def _verify_all_items(
        self,
        tasks: list[TaskPayload],
        decisions: list[DecisionPayload],
        risks: list[RiskPayload],
        questions: list[OpenQuestionPayload],
        transcript_text: str,
        meeting_date: Any | None,
        attendees: list[str] | None,
    ) -> tuple[
        list[TaskPayload],
        list[DecisionPayload],
        list[RiskPayload],
        list[OpenQuestionPayload],
    ]:
        """Run post-extraction deterministic verification across all extracted items."""
        verified_tasks: list[TaskPayload] = []
        for task in tasks:
            # 1. Evidence quotes check
            ev, ev_conf, ev_flags = verify_evidence_quotes(task.evidence, transcript_text)
            # 2. Owner validation
            owner, owner_conf, owner_flags = verify_owner(task.owner, transcript_text, attendees)
            # 3. Date verification
            due, due_conf, due_flags = verify_due_date(task.due, meeting_date)

            # Combined confidence rating
            all_confs = [ev_conf, owner_conf, due_conf]
            final_conf = (
                Confidence.LOW
                if Confidence.LOW in all_confs
                else (Confidence.MEDIUM if Confidence.MEDIUM in all_confs else Confidence.HIGH)
            )

            all_clarifications = (
                list(task.clarification_needed) + ev_flags + owner_flags + due_flags
            )
            # Deduplicate clarification flags
            unique_clarifications = list(dict.fromkeys(all_clarifications))

            v_task = task.model_copy(
                update={
                    "evidence": ev,
                    "owner": owner,
                    "due": due,
                    "confidence": final_conf,
                    "clarification_needed": unique_clarifications,
                }
            )
            verified_tasks.append(v_task)

        verified_decisions: list[DecisionPayload] = []
        for dec in decisions:
            ev, ev_conf, _ = verify_evidence_quotes(dec.evidence, transcript_text)
            v_dec = dec.model_copy(update={"evidence": ev, "confidence": ev_conf})
            verified_decisions.append(v_dec)

        verified_risks: list[RiskPayload] = []
        for risk in risks:
            ev, ev_conf, _ = verify_evidence_quotes(risk.evidence, transcript_text)
            owner, owner_conf, _ = verify_owner(risk.owner, transcript_text, attendees)
            final_conf = (
                Confidence.LOW
                if (ev_conf == Confidence.LOW or owner_conf == Confidence.LOW)
                else Confidence.MEDIUM
            )
            v_risk = risk.model_copy(
                update={"evidence": ev, "owner": owner, "confidence": final_conf}
            )
            verified_risks.append(v_risk)

        verified_questions: list[OpenQuestionPayload] = []
        for q in questions:
            ev, ev_conf, _ = verify_evidence_quotes(q.evidence, transcript_text)
            v_q = q.model_copy(update={"evidence": ev, "confidence": ev_conf})
            verified_questions.append(v_q)

        # 4. Check for reversals and cancellations in subsequent lines
        verified_tasks, verified_decisions = apply_reversals_and_cancellations(
            verified_tasks, verified_decisions, transcript_text
        )

        return (
            verified_tasks,
            verified_decisions,
            verified_risks,
            verified_questions,
        )

    def run(
        self,
        db: Session,
        meeting_id: str,
        policy: ReExtractionPolicy = ReExtractionPolicy.PRESERVE_REVIEWED,
        custom_model: str | None = None,
    ) -> ExtractionRunResponse:
        """Execute full extraction workflow and persist results to MySQL."""
        start_time = time.time()
        meeting = MeetingRepository.get_by_id(db, meeting_id)
        if not meeting:
            raise EntityNotFoundError(f"Meeting with ID '{meeting_id}' not found.")

        client = self._get_client(custom_model=custom_model)
        model_name = getattr(client, "model_name", settings.GEMINI_MODEL)
        prompt_version = settings.PROMPT_VERSION

        # Normalize speaker labels and get indexed lines
        _, indexed_lines = process_transcript_lines(meeting.raw_text)

        # Check existing items for re-extraction policy
        existing_items = list(meeting.items)
        has_reviewed_items = any(
            it.edited_by_human or it.review_status in ("accepted", "rejected")
            for it in existing_items
        )

        # Split into tokens/chunks
        chunks = self.chunk_transcript(
            indexed_lines,
            client,
            target_tokens=settings.CHUNK_TARGET_TOKENS,
            overlap_tokens=settings.CHUNK_OVERLAP_TOKENS,
        )

        total_tin = 0
        total_tout = 0
        raw_tasks: list[TaskPayload] = []
        raw_decisions: list[DecisionPayload] = []
        raw_risks: list[RiskPayload] = []
        raw_questions: list[OpenQuestionPayload] = []

        attendees_str = ", ".join(meeting.attendees or []) if meeting.attendees else "Not specified"

        for _chunk_idx, chunk_text in enumerate(chunks):
            user_prompt = CHUNK_EXTRACTION_USER_PROMPT.format(
                title=meeting.title,
                meeting_date=str(meeting.meeting_date or "Unknown"),
                attendees=attendees_str,
                transcript_chunk=chunk_text,
            )

            chunk_result, tin, tout = self._extract_chunk_with_retry(
                client=client,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                max_retries=settings.LLM_MAX_RETRIES,
            )
            if tin:
                total_tin += tin
            if tout:
                total_tout += tout

            raw_tasks.extend(chunk_result.tasks)
            raw_decisions.extend(chunk_result.decisions)
            raw_risks.extend(chunk_result.risks)
            raw_questions.extend(chunk_result.open_questions)

        # Deduplicate across chunk boundaries
        dedup_tasks, dedup_decisions, dedup_risks, dedup_questions = self._deduplicate_items(
            raw_tasks, raw_decisions, raw_risks, raw_questions
        )

        # Post-extraction verification
        v_tasks, v_decisions, v_risks, v_questions = self._verify_all_items(
            dedup_tasks,
            dedup_decisions,
            dedup_risks,
            dedup_questions,
            transcript_text=meeting.raw_text,
            meeting_date=meeting.meeting_date,
            attendees=meeting.attendees,
        )

        latency_ms = int((time.time() - start_time) * 1000)

        # Save to MySQL inside transaction
        persisted_items: list[ItemModel] = []

        # If policy is PRESERVE_REVIEWED, retain reviewed items and remove only unreviewed items
        if policy == ReExtractionPolicy.PRESERVE_REVIEWED and has_reviewed_items:
            for it in existing_items:
                if not it.edited_by_human and it.review_status == "needs_review":
                    db.delete(it)
        else:
            # Overwrite unreviewed items
            for it in existing_items:
                if not it.edited_by_human:
                    db.delete(it)

        # Add new tasks
        for t in v_tasks:
            it = ItemModel(
                meeting_id=meeting.id,
                item_type="task",
                payload_json=t.model_dump(mode="json"),
                review_status="needs_review",
            )
            db.add(it)
            persisted_items.append(it)

        # Add new decisions
        for d in v_decisions:
            it = ItemModel(
                meeting_id=meeting.id,
                item_type="decision",
                payload_json=d.model_dump(mode="json"),
                review_status="accepted" if d.confidence == Confidence.HIGH else "needs_review",
            )
            db.add(it)
            persisted_items.append(it)

        # Add new risks
        for r in v_risks:
            it = ItemModel(
                meeting_id=meeting.id,
                item_type="risk",
                payload_json=r.model_dump(mode="json"),
                review_status="needs_review",
            )
            db.add(it)
            persisted_items.append(it)

        # Add new questions
        for q in v_questions:
            it = ItemModel(
                meeting_id=meeting.id,
                item_type="open_question",
                payload_json=q.model_dump(mode="json"),
                review_status="needs_review",
            )
            db.add(it)
            persisted_items.append(it)

        # Save operational extraction run
        run_record = RunModel(
            meeting_id=meeting.id,
            model_name=model_name,
            prompt_version=prompt_version,
            tokens_in=total_tin or None,
            tokens_out=total_tout or None,
            latency_ms=latency_ms,
            validation_ok=True,
        )
        db.add(run_record)
        db.commit()

        # Build response objects
        response_items = [
            ItemResponse(
                id=it.id,
                meeting_id=it.meeting_id,
                item_type=it.item_type,
                payload=it.payload_json,
                review_status=it.review_status,
                edited_by_human=it.edited_by_human,
                duplicate_of=it.duplicate_of,
                created_at=it.created_at,
            )
            for it in persisted_items
        ]

        return ExtractionRunResponse(
            run_id=run_record.id,
            meeting_id=meeting.id,
            model_name=model_name,
            prompt_version=prompt_version,
            latency_ms=latency_ms,
            tokens_in=total_tin or None,
            tokens_out=total_tout or None,
            tasks_count=len(v_tasks),
            decisions_count=len(v_decisions),
            risks_count=len(v_risks),
            open_questions_count=len(v_questions),
            validation_ok=True,
            items=response_items,
            extracted_at=datetime.now(UTC),
            message=(
                "Meeting successfully extracted and verified."
                if not has_reviewed_items
                else "Re-extracted meeting; previously reviewed items were safely preserved."
            ),
        )
