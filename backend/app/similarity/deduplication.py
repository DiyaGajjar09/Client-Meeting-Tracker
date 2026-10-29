"""TF-IDF Cosine Similarity Deduplication Engine.

Detects candidate duplicate action items across meetings for the same client
using scikit-learn unigram and bigram TF-IDF vectorization and cosine similarity.
Adheres strictly to client isolation, no auto-merge, and no fabrication rules.
"""

from __future__ import annotations

import re
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.models import DuplicateResolutionModel, ItemModel, MeetingModel


def normalize_text(text: str) -> str:
    """Normalize text for TF-IDF comparison: lowercase, remove punctuation while retaining alphanumerics."""
    if not text:
        return ""
    # Lowercase and convert punctuation to whitespace
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    # Collapse multiple whitespaces
    return " ".join(cleaned.split())


def calculate_pair_similarity(
    text1: str,
    text2: str,
    owner1: str | None = None,
    owner2: str | None = None,
    date1: str | None = None,
    date2: str | None = None,
) -> float:
    """Calculate TF-IDF cosine similarity between two texts with optional metadata boost."""
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)

    if not norm1 or not norm2:
        return 0.0

    if norm1 == norm2:
        base_score = 1.0
    else:
        try:
            vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
            tfidf_matrix = vectorizer.fit_transform([norm1, norm2])
            sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            base_score = float(sim)
        except (ValueError, ZeroDivisionError):
            # Happens if both texts only contain stop words or no recognized features
            words1 = set(norm1.split())
            words2 = set(norm2.split())
            if not words1 or not words2:
                base_score = 0.0
            else:
                base_score = len(words1 & words2) / len(words1 | words2)

    # Metadata boost: small bonus if confirmed owners or due dates match
    boost = 0.0
    if owner1 and owner2 and owner1.strip().lower() == owner2.strip().lower():
        boost += 0.03
    if date1 and date2 and str(date1).strip() == str(date2).strip():
        boost += 0.03

    final_score = min(1.0, max(0.0, base_score + boost))
    return round(final_score, 4)


def get_match_category(
    score: float,
    likely_threshold: float = settings.DUPLICATE_LIKELY_THRESHOLD,
    possible_threshold: float = settings.DUPLICATE_POSSIBLE_THRESHOLD,
) -> str | None:
    """Categorize score into duplicate tier or None if below threshold."""
    if score >= likely_threshold:
        return "likely_duplicate"
    elif score >= possible_threshold:
        return "possibly_related"
    return None


class DeduplicationService:
    """Service detecting and resolving duplicate tasks for a client."""

    @staticmethod
    def get_meeting_duplicates(
        db: Session,
        meeting_id: str,
        threshold: float | None = None,
    ) -> list[dict[str, Any]]:
        """Find duplicate candidates for all tasks in a meeting against client history."""
        # 1. Fetch target meeting and verify client
        meeting = db.scalar(
            select(MeetingModel)
            .options(joinedload(MeetingModel.client))
            .where(MeetingModel.id == meeting_id)
        )
        if not meeting:
            return []

        client_id = meeting.client_id
        min_threshold = (
            threshold if threshold is not None else settings.DUPLICATE_POSSIBLE_THRESHOLD
        )

        # 2. Fetch current meeting tasks
        current_tasks = list(
            db.scalars(
                select(ItemModel).where(
                    ItemModel.meeting_id == meeting_id,
                    ItemModel.item_type == "task",
                    ItemModel.review_status != "rejected",
                )
            ).all()
        )
        if not current_tasks:
            return []

        # 3. Fetch candidate tasks from the same client (exclude current meeting or exclude same item)
        candidate_tasks = list(
            db.scalars(
                select(ItemModel)
                .join(MeetingModel, ItemModel.meeting_id == MeetingModel.id)
                .options(joinedload(ItemModel.meeting))
                .where(
                    MeetingModel.client_id == client_id,
                    ItemModel.id.notin_([t.id for t in current_tasks]),
                    ItemModel.item_type == "task",
                    ItemModel.review_status != "rejected",
                )
            ).all()
        )
        if not candidate_tasks:
            return []

        # 4. Fetch existing resolutions for this client to determine status
        resolutions = list(
            db.scalars(
                select(DuplicateResolutionModel).where(
                    DuplicateResolutionModel.client_id == client_id
                )
            ).all()
        )
        # Map (min_id, max_id) -> resolution
        resolution_map: dict[tuple[str, str], DuplicateResolutionModel] = {}
        for r in resolutions:
            pair_key = (min(r.item1_id, r.item2_id), max(r.item1_id, r.item2_id))
            resolution_map[pair_key] = r

        results: list[dict[str, Any]] = []

        # 5. Compare current tasks against candidate tasks
        for cur_item in current_tasks:
            cur_payload = cur_item.payload_json or {}
            cur_desc = cur_payload.get("description", "")
            cur_owner = cur_payload.get("owner", {}).get("name")
            cur_due = cur_payload.get("due", {}).get("resolved_date")

            for cand_item in candidate_tasks:
                cand_payload = cand_item.payload_json or {}
                cand_desc = cand_payload.get("description", "")
                cand_owner = cand_payload.get("owner", {}).get("name")
                cand_due = cand_payload.get("due", {}).get("resolved_date")

                score = calculate_pair_similarity(
                    cur_desc,
                    cand_desc,
                    owner1=cur_owner,
                    owner2=cand_owner,
                    date1=str(cur_due) if cur_due else None,
                    date2=str(cand_due) if cand_due else None,
                )

                if score < min_threshold:
                    continue

                category = get_match_category(score)
                pair_key = (min(cur_item.id, cand_item.id), max(cur_item.id, cand_item.id))
                existing_res = resolution_map.get(pair_key)
                status_label = existing_res.resolution if existing_res else "pending"

                results.append(
                    {
                        "id": f"dup_{cur_item.id[:8]}_{cand_item.id[:8]}",
                        "similarity_score": score,
                        "match_category": category,
                        "status": status_label,
                        "current_task": {
                            "id": cur_item.id,
                            "meeting_id": cur_item.meeting_id,
                            "meeting_title": meeting.title,
                            "meeting_date": str(meeting.meeting_date)
                            if meeting.meeting_date
                            else None,
                            "description": cur_desc,
                            "owner": cur_owner,
                            "due_date": cur_due,
                            "review_status": cur_item.review_status,
                            "confidence": cur_payload.get("confidence", "medium"),
                            "evidence_quote": cur_payload.get("evidence", [{}])[0].get("quote")
                            if cur_payload.get("evidence")
                            else None,
                        },
                        "candidate_task": {
                            "id": cand_item.id,
                            "meeting_id": cand_item.meeting_id,
                            "meeting_title": cand_item.meeting.title if cand_item.meeting else "",
                            "meeting_date": str(cand_item.meeting.meeting_date)
                            if cand_item.meeting and cand_item.meeting.meeting_date
                            else None,
                            "description": cand_desc,
                            "owner": cand_owner,
                            "due_date": cand_due,
                            "review_status": cand_item.review_status,
                            "confidence": cand_payload.get("confidence", "medium"),
                            "evidence_quote": cand_payload.get("evidence", [{}])[0].get("quote")
                            if cand_payload.get("evidence")
                            else None,
                        },
                    }
                )

        # Sort results: highest similarity score first
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results

