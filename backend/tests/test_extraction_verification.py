from datetime import date

from app.schemas.common import (
    Confidence,
    DecisionPayload,
    DueDate,
    Evidence,
    FieldState,
    Owner,
    TaskPayload,
)
from app.services.pipeline import ExtractionPipeline
from app.verify.dates import resolve_relative_date, verify_due_date
from app.verify.evidence import verify_evidence_quotes
from app.verify.owners import sanitize_owner, verify_owner
from app.verify.reversals import apply_reversals_and_cancellations


def test_1_clearly_stated_task_and_owner():
    """Case 1: A clearly stated task and owner from transcript dialogue."""
    transcript = "Priya: I will finalize the client onboarding workflow by next Friday."
    owner = Owner(name="Priya", state=FieldState.STATED)
    sanitized_owner, conf, warnings = verify_owner(owner, transcript, attendees=["Priya"])
    assert sanitized_owner.name == "Priya"
    assert sanitized_owner.state == FieldState.STATED
    assert conf == Confidence.HIGH
    assert len(warnings) == 0


def test_2_task_without_owner_enforces_null():
    """Case 2: A task without an owner - name MUST be null and state not_stated."""
    # LLM tried to assign generic 'someone' or 'the team'
    owner_raw = Owner(name="someone", state=FieldState.NOT_STATED)
    sanitized = sanitize_owner(owner_raw)
    assert sanitized.name is None
    assert sanitized.state == FieldState.NOT_STATED

    owner_team = Owner(name="the team", state=FieldState.NOT_STATED)
    assert sanitize_owner(owner_team).name is None


def test_3_task_without_due_date():
    """Case 3: A task without a due date retains null resolved_date."""
    due = DueDate(raw_text=None, resolved_date=None, state=FieldState.NOT_STATED)
    verified, conf, _ = verify_due_date(due, meeting_date=date(2026, 10, 28))
    assert verified.resolved_date is None
    assert verified.state == FieldState.NOT_STATED


def test_4_vague_deadline_preserves_wording():
    """Case 4: A vague deadline such as 'soon' or 'asap' retains null date."""
    due = DueDate(raw_text="as soon as possible", resolved_date=None, state=FieldState.NOT_STATED)
    verified, conf, _ = verify_due_date(due, meeting_date=date(2026, 10, 28))
    assert verified.raw_text == "as soon as possible"
    assert verified.resolved_date is None
    assert verified.state == FieldState.NOT_STATED


def test_5_relative_deadline_with_known_meeting_date():
    """Case 5: Relative deadline 'next Friday' with meeting on Wednesday Oct 28 2026."""
    # Meeting date: Wednesday Oct 28, 2026
    # This Friday = Oct 30, 2026
    # Next Friday (following week) = Nov 6, 2026
    meeting_date = date(2026, 10, 28)
    resolved, state = resolve_relative_date("by next Friday", meeting_date)
    assert resolved == date(2026, 11, 6)
    assert state == FieldState.STATED

    # This Friday
    resolved_curr, _ = resolve_relative_date("by Friday", meeting_date)
    assert resolved_curr == date(2026, 10, 30)

    # Tomorrow
    resolved_tmrw, _ = resolve_relative_date("tomorrow", meeting_date)
    assert resolved_tmrw == date(2026, 10, 29)


def test_6_relative_deadline_without_meeting_date():
    """Case 6: Relative deadline without meeting date preserves raw wording and leaves date null."""
    due = DueDate(raw_text="by next Friday", resolved_date=None, state=FieldState.NOT_STATED)
    verified, conf, warnings = verify_due_date(due, meeting_date=None)
    assert verified.raw_text == "by next Friday"
    assert verified.resolved_date is None
    assert verified.state == FieldState.NOT_STATED
    assert any("meeting date is unknown" in w.lower() for w in warnings)


def test_7_implied_owner():
    """Case 7: An implied owner must have state=implied and not inflated to high confidence."""
    transcript = "Alex: Should I write the unit tests?\nRahul: Yeah that would be great."
    owner = Owner(name="Alex", state=FieldState.IMPLIED, note="Volunteered during turn")
    sanitized, conf, warnings = verify_owner(owner, transcript, attendees=["Alex", "Rahul"])
    assert sanitized.name == "Alex"
    assert sanitized.state == FieldState.IMPLIED
    assert conf == Confidence.MEDIUM


def test_8_conflicting_owners_marked_for_clarification():
    """Case 8: Conflicting or unsupported owner gets flagged."""
    transcript = "Discussion about the cloud migration plan."
    owner = Owner(name="ExternalConsultant", state=FieldState.STATED)
    sanitized, conf, warnings = verify_owner(owner, transcript, attendees=["Alex", "Rahul"])
    assert conf == Confidence.LOW
    assert any("not found in attendee list" in w for w in warnings)


def test_9_decision_reversed_later_in_meeting():
    """Case 9: A decision agreed earlier but reversed later in transcript."""
    transcript = (
        "L1: Rahul: We have decided to migrate the cluster to AWS.\n"
        "L2: Priya: Okay confirmed.\n"
        "L3: Alex: Wait everyone, our AWS contract was cancelled. We decided against moving to AWS."
    )
    decisions = [
        DecisionPayload(
            id="d1",
            statement="Migrate cluster to AWS",
            decided_by="Rahul",
            confidence=Confidence.HIGH,
            evidence=[
                Evidence(
                    quote="We have decided to migrate the cluster to AWS.",
                    speaker="Rahul",
                    line_start=1,
                    line_end=2,
                )
            ],
        )
    ]
    tasks: list[TaskPayload] = []
    annotated_tasks, annotated_decisions = apply_reversals_and_cancellations(
        tasks, decisions, transcript
    )
    assert len(annotated_decisions) == 1
    assert "[REVERSED]" in annotated_decisions[0].statement
    assert annotated_decisions[0].confidence == Confidence.LOW


def test_10_cancelled_task_detected():
    """Case 10: An action item discussed but later cancelled in dialogue."""
    transcript = (
        "L1: Priya: Rahul, please build the reporting dashboard by Friday.\n"
        "L2: Rahul: Will do.\n"
        "L3: Priya: Wait, scratch that reporting dashboard task, the client just cancelled that feature request."
    )
    tasks = [
        TaskPayload(
            id="t1",
            description="Build the reporting dashboard",
            owner=Owner(name="Rahul", state=FieldState.STATED),
            due=DueDate(raw_text="by Friday", state=FieldState.STATED),
            confidence=Confidence.HIGH,
            evidence=[
                Evidence(
                    quote="Rahul, please build the reporting dashboard",
                    speaker="Priya",
                    line_start=1,
                    line_end=2,
                )
            ],
        )
    ]
    annotated_tasks, _ = apply_reversals_and_cancellations(tasks, [], transcript)
    assert len(annotated_tasks) == 1
    assert annotated_tasks[0].confidence == Confidence.LOW
    assert any("CANCELLED" in c for c in annotated_tasks[0].clarification_needed)


def test_11_duplicate_items_merged_across_chunks():
    """Case 11: Duplicate items from overlapping chunks are merged."""
    pipeline = ExtractionPipeline()
    t1 = TaskPayload(
        id="t1",
        description="Finalize the MySQL schema models and Alembic migrations",
        owner=Owner(name="Rahul", state=FieldState.STATED),
        due=DueDate(state=FieldState.NOT_STATED),
    )
    t2 = TaskPayload(
        id="t2",
        description="Finalize the MySQL schema models and migrations",
        owner=Owner(name="Rahul", state=FieldState.STATED),
        due=DueDate(state=FieldState.NOT_STATED),
    )
    deduped_tasks, _, _, _ = pipeline._deduplicate_items([t1, t2], [], [], [])
    assert len(deduped_tasks) == 1


def test_12_quote_not_found_flags_low_confidence():
    """Case 12: An evidence quote that does not exist in transcript is flagged low confidence."""
    transcript = "Priya: We should review the frontend performance."
    evidence = [
        Evidence(quote="The team agreed to buy 50 new laptops immediately.", speaker="Priya")
    ]
    verified, conf, flags = verify_evidence_quotes(evidence, transcript)
    assert conf == Confidence.LOW
    assert any("not verified in transcript" in f for f in flags)
