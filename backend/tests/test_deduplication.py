from unittest.mock import MagicMock

import pytest

from app.core.exceptions import InvalidInputError
from app.db.models import DuplicateResolutionModel, ItemModel, MeetingModel
from app.schemas.review import DuplicateResolveRequest
from app.services.item_service import ItemService
from app.similarity.deduplication import (
    DeduplicationService,
    calculate_pair_similarity,
    get_match_category,
    normalize_text,
)


def test_text_normalization():
    """Text normalization lowercases, removes punctuation, and collapses spaces."""
    raw = "Draft the API spec! (v2.0) -- by next Friday."
    norm = normalize_text(raw)
    assert norm == "draft the api spec v2 0 by next friday"


def test_similarity_identical_texts():
    """Identical text yields similarity score of 1.0."""
    score = calculate_pair_similarity(
        "Finalize database migration plan",
        "Finalize database migration plan",
    )
    assert score == 1.0
    assert get_match_category(score) == "likely_duplicate"


def test_similarity_threshold_tiers():
    """Verify tier assignment for likely_duplicate, possibly_related, and below threshold."""
    assert get_match_category(0.85) == "likely_duplicate"
    assert get_match_category(0.80) == "likely_duplicate"
    assert get_match_category(0.75) == "possibly_related"
    assert get_match_category(0.60) == "possibly_related"
    assert get_match_category(0.59) is None
    assert get_match_category(0.20) is None


def test_similarity_metadata_boost():
    """Matching owner and date provides a bounded boost to similarity."""
    desc1 = "Prepare deployment testing environment"
    desc2 = "Prepare staging deployment environment"

    score_without = calculate_pair_similarity(desc1, desc2)
    score_with = calculate_pair_similarity(
        desc1, desc2, owner1="Sarah", owner2="Sarah", date1="2026-11-01", date2="2026-11-01"
    )

    assert score_with >= score_without
    assert score_with <= 1.0


def test_duplicate_detection_client_isolation():
    """Duplicate detection must strictly query within the same client and never leak candidates across clients."""
    meeting_client_a = MeetingModel(id="m-a1", client_id="client-A", title="Sync A")
    task_client_a1 = ItemModel(
        id="t-a1",
        meeting_id="m-a1",
        item_type="task",
        payload_json={"description": "Conduct security audit"},
        review_status="needs_review",
    )

    # Candidate belonging to Client B with the EXACT same task description
    meeting_client_b = MeetingModel(id="m-b1", client_id="client-B", title="Sync B")
    task_client_b1 = ItemModel(
        id="t-b1",
        meeting_id="m-b1",
        item_type="task",
        payload_json={"description": "Conduct security audit"},
        review_status="needs_review",
    )
    task_client_b1.meeting = meeting_client_b

    mock_db = MagicMock()
    # Mocking DB queries: scalar for meeting returns meeting_client_a
    mock_db.scalar.side_effect = [meeting_client_a]
    # Scalars for current_tasks, candidate_tasks (empty because client-A has no other meetings), resolutions
    mock_db.scalars.side_effect = [
        MagicMock(all=lambda: [task_client_a1]),  # current_tasks
        MagicMock(all=lambda: []),  # candidate_tasks for client-A
    ]

    duplicates = DeduplicationService.get_meeting_duplicates(mock_db, meeting_id="m-a1")
    # Even though Client B has an identical task, Client A candidates must be empty
    assert len(duplicates) == 0


def test_resolve_duplicate_decisions(monkeypatch):
    """Test resolution decisions: keep_both, discarded, and cycle prevention."""
    mock_db = MagicMock()

    item1 = ItemModel(
        id="t1",
        meeting_id="m1",
        item_type="task",
        payload_json={"description": "Task 1"},
        review_status="needs_review",
    )
    item1.meeting = MeetingModel(id="m1", client_id="client-1")

    item2 = ItemModel(
        id="t2",
        meeting_id="m2",
        item_type="task",
        payload_json={"description": "Task 2"},
        review_status="needs_review",
    )
    item2.meeting = MeetingModel(id="m2", client_id="client-1")

    monkeypatch.setattr(
        ItemService,
        "get_item",
        lambda db, iid: item1 if iid == "t1" else item2,
    )
    from app.repositories.item_repository import ItemRepository

    monkeypatch.setattr(
        ItemRepository,
        "get_by_id",
        lambda db, iid: item1 if iid == "t1" else item2,
    )
    monkeypatch.setattr(ItemRepository, "log_review_event", lambda **kwargs: None)

    fake_res = DuplicateResolutionModel(
        id="res-1",
        client_id="client-1",
        item1_id="t1",
        item2_id="t2",
        resolution="keep_both",
    )
    monkeypatch.setattr(ItemRepository, "save_duplicate_resolution", lambda **kwargs: fake_res)

    # 1. Keep Both
    res_keep = ItemService.resolve_duplicate(
        mock_db,
        client_id="client-1",
        resolve_in=DuplicateResolveRequest(item1_id="t1", item2_id="t2", resolution="keep_both"),
    )
    assert res_keep.resolution == "keep_both"

    # 2. Self reference rejection
    with pytest.raises(InvalidInputError):
        ItemService.resolve_duplicate(
            mock_db,
            client_id="client-1",
            resolve_in=DuplicateResolveRequest(item1_id="t1", item2_id="t1", resolution="keep_both"),
        )

