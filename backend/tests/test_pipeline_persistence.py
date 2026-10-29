from datetime import date
from unittest.mock import MagicMock

from app.db.models import ItemModel, MeetingModel
from app.llm.mock_provider import MockLLMClient
from app.schemas.extraction import ReExtractionPolicy
from app.services.pipeline import ExtractionPipeline


def test_17_pipeline_persistence_and_run_logging():
    """Case 17: Pipeline saves extracted items and logs operational run metrics."""
    mock_db = MagicMock()
    mock_meeting = MeetingModel(
        id="m1",
        client_id="c1",
        title="Weekly Sprint",
        meeting_date=date(2026, 10, 28),
        raw_text="Priya: Rahul, please review the API contract by Friday.\nRahul: Sure thing.",
        attendees=["Priya", "Rahul"],
    )
    mock_meeting.items = []
    mock_db.scalars.return_value.unique.return_value.first.return_value = mock_meeting

    mock_llm = MockLLMClient(
        canned_response={
            "tasks": [
                {
                    "id": "t1",
                    "description": "Review the API contract",
                    "owner": {"name": "Rahul", "state": "stated"},
                    "due": {"raw_text": "by Friday", "state": "stated"},
                    "evidence": [
                        {
                            "quote": "Rahul, please review the API contract by Friday.",
                            "speaker": "Priya",
                            "line_start": 1,
                            "line_end": 1,
                        }
                    ],
                }
            ],
            "decisions": [],
            "risks": [],
            "open_questions": [],
        }
    )

    pipeline = ExtractionPipeline(llm_client=mock_llm)
    res = pipeline.run(db=mock_db, meeting_id="m1")

    assert res.tasks_count == 1
    assert res.validation_ok is True
    assert res.items[0].payload["owner"]["name"] == "Rahul"
    # Resolved date should be Friday Oct 30, 2026
    assert res.items[0].payload["due"]["resolved_date"] == "2026-10-30"
    assert mock_db.commit.called


def test_18_re_extraction_preserves_reviewed_items():
    """Case 18: Re-extraction preserves previously accepted/edited items under default policy."""
    mock_db = MagicMock()
    mock_meeting = MeetingModel(
        id="m1",
        client_id="c1",
        title="Weekly Sprint",
        meeting_date=date(2026, 10, 28),
        raw_text="Priya: Rahul, please review the API contract.",
        attendees=["Priya", "Rahul"],
    )

    # Previously reviewed item (accepted by human reviewer)
    existing_reviewed = ItemModel(
        id="item-old-1",
        meeting_id="m1",
        item_type="task",
        payload_json={"description": "Previously reviewed task"},
        review_status="accepted",
        edited_by_human=True,
    )
    # Previously unreviewed item
    existing_unreviewed = ItemModel(
        id="item-old-2",
        meeting_id="m1",
        item_type="task",
        payload_json={"description": "Stale unreviewed task"},
        review_status="needs_review",
        edited_by_human=False,
    )

    mock_meeting.items = [existing_reviewed, existing_unreviewed]
    mock_db.scalars.return_value.unique.return_value.first.return_value = mock_meeting

    mock_llm = MockLLMClient(
        canned_response={
            "tasks": [
                {
                    "id": "t2",
                    "description": "Newly extracted action",
                    "owner": {"name": "Priya", "state": "stated"},
                    "due": {"state": "not_stated"},
                    "evidence": [{"quote": "Priya: Rahul", "speaker": "Priya"}],
                }
            ],
            "decisions": [],
            "risks": [],
            "open_questions": [],
        }
    )

    pipeline = ExtractionPipeline(llm_client=mock_llm)
    res = pipeline.run(
        db=mock_db,
        meeting_id="m1",
        policy=ReExtractionPolicy.PRESERVE_REVIEWED,
    )

    # Deleted stale unreviewed item, but preserved existing_reviewed
    mock_db.delete.assert_called_with(existing_unreviewed)
    assert "previously reviewed items were safely preserved" in res.message.lower()

