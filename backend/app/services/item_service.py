from __future__ import annotations

import copy
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundError, InvalidInputError
from app.db.models import ItemModel, generate_uuid
from app.repositories.item_repository import ItemRepository
from app.schemas.item import (
    ItemMergeRequest,
    ItemMergeResponse,
    ItemResponse,
    ItemSplitRequest,
    ItemSplitResponse,
    ItemUpdate,
)
from app.schemas.review import DuplicateResolveRequest, DuplicateResolveResponse


class ItemService:
    """Service layer managing review items, merges, splits, audit events, and duplicate resolutions."""

    @staticmethod
    def _to_response(item: ItemModel) -> ItemResponse:
        return ItemResponse(
            id=item.id,
            meeting_id=item.meeting_id,
            item_type=item.item_type,
            payload=item.payload_json or {},
            review_status=item.review_status,
            edited_by_human=item.edited_by_human,
            duplicate_of=item.duplicate_of,
            created_at=item.created_at,
        )

    @staticmethod
    def get_item(db: Session, item_id: str) -> ItemResponse:
        item = ItemRepository.get_by_id(db, item_id)
        if not item:
            raise EntityNotFoundError(f"Item with ID '{item_id}' not found.")
        return ItemService._to_response(item)

    @staticmethod
    def list_items(
        db: Session,
        meeting_id: str | None = None,
        item_type: str | None = None,
        review_status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[ItemResponse], int]:
        items, total = ItemRepository.list_all(
            db,
            meeting_id=meeting_id,
            item_type=item_type,
            review_status=review_status,
            skip=skip,
            limit=limit,
        )
        return [ItemService._to_response(it) for it in items], total

    @staticmethod
    def update_item(db: Session, item_id: str, update_in: ItemUpdate) -> ItemResponse:
        """Update review item status or field values with audit tracking."""
        item = ItemRepository.get_by_id(db, item_id)
        if not item:
            raise EntityNotFoundError(f"Item with ID '{item_id}' not found.")

        old_val = {
            "review_status": item.review_status,
            "payload": copy.deepcopy(item.payload_json or {}),
        }

        new_payload = copy.deepcopy(item.payload_json or {})

        # If a whole replacement payload was sent
        if update_in.payload is not None:
            new_payload = update_in.payload

        # Handle granular field updates
        if update_in.description is not None:
            new_payload["description"] = update_in.description
        if update_in.statement is not None:
            new_payload["statement"] = update_in.statement
        if update_in.question is not None:
            new_payload["question"] = update_in.question

        # Owner updates
        if update_in.owner_name is not None or update_in.owner_state is not None:
            owner_dict = new_payload.setdefault("owner", {})
            if update_in.owner_name is not None:
                owner_dict["name"] = update_in.owner_name
                owner_dict["state"] = (
                    update_in.owner_state.value
                    if update_in.owner_state
                    else ("stated" if update_in.owner_name else "not_stated")
                )
            elif update_in.owner_state is not None:
                owner_dict["state"] = update_in.owner_state.value
                if update_in.owner_state.value == "not_stated":
                    owner_dict["name"] = None

        # Due date updates
        if (
            update_in.resolved_date is not None
            or update_in.raw_date_wording is not None
            or update_in.due_date_state is not None
        ):
            due_dict = new_payload.setdefault("due", {})
            if update_in.resolved_date is not None:
                due_dict["resolved_date"] = str(update_in.resolved_date)
                due_dict["state"] = (
                    update_in.due_date_state.value if update_in.due_date_state else "stated"
                )
            if update_in.raw_date_wording is not None:
                due_dict["raw_text"] = update_in.raw_date_wording
            if update_in.due_date_state is not None and update_in.due_date_state.value == "not_stated":
                due_dict["resolved_date"] = None
                due_dict["state"] = "not_stated"

        if update_in.priority is not None:
            new_payload["priority"] = update_in.priority
        if update_in.confidence is not None:
            new_payload["confidence"] = update_in.confidence.value

        status_val = update_in.review_status.value if update_in.review_status else None

        updated = ItemRepository.update(
            db,
            item_id=item_id,
            review_status=status_val,
            payload_json=new_payload,
            edited_by_human=True,
            action=update_in.action,
            actor=update_in.actor,
            old_value=old_val,
        )
        return ItemService._to_response(updated)

    @staticmethod
    def merge_items(
        db: Session,
        canonical_id: str,
        merge_in: ItemMergeRequest,
    ) -> ItemMergeResponse:
        """Merge source item into canonical item preserving evidence and review history."""
        if canonical_id == merge_in.source_item_id:
            raise InvalidInputError("Cannot merge an item with itself.")

        canonical_item = ItemRepository.get_by_id(db, canonical_id)
        if not canonical_item:
            raise EntityNotFoundError(f"Canonical item '{canonical_id}' not found.")

        source_item = ItemRepository.get_by_id(db, merge_in.source_item_id)
        if not source_item:
            raise EntityNotFoundError(f"Source item '{merge_in.source_item_id}' not found.")

        # Verify client isolation: both meetings must belong to same client
        if (
            not canonical_item.meeting
            or not source_item.meeting
            or canonical_item.meeting.client_id != source_item.meeting.client_id
        ):
            raise InvalidInputError("Cannot merge items belonging to different clients.")

        # Verify type compatibility
        if canonical_item.item_type != source_item.item_type:
            raise InvalidInputError(
                f"Cannot merge incompatible item types '{canonical_item.item_type}' and '{source_item.item_type}'."
            )

        # Execute transaction
        try:
            # 1. Preserve and combine evidence
            can_payload = copy.deepcopy(canonical_item.payload_json or {})
            src_payload = copy.deepcopy(source_item.payload_json or {})

            can_ev = can_payload.get("evidence", [])
            src_ev = src_payload.get("evidence", [])

            if merge_in.combine_evidence:
                seen_quotes = {
                    e.get("quote", "").strip() for e in can_ev if isinstance(e, dict)
                }
                combined_ev = list(can_ev)
                for ev in src_ev:
                    if isinstance(ev, dict) and ev.get("quote", "").strip() not in seen_quotes:
                        combined_ev.append(ev)
                        seen_quotes.add(ev.get("quote", "").strip())
                can_payload["evidence"] = combined_ev

            # 2. Apply preferred values if specified
            if merge_in.preferred_description:
                can_payload["description"] = merge_in.preferred_description
            if merge_in.preferred_owner_name:
                can_payload.setdefault("owner", {})["name"] = merge_in.preferred_owner_name
                can_payload["owner"]["state"] = "stated"
            if merge_in.preferred_due_date:
                can_payload.setdefault("due", {})["resolved_date"] = str(
                    merge_in.preferred_due_date
                )
                can_payload["due"]["state"] = "stated"

            # Track merge lineage
            merged_sources = can_payload.get("merged_sources", [])
            if source_item.id not in merged_sources:
                merged_sources.append(source_item.id)
            can_payload["merged_sources"] = merged_sources

            # 3. Update canonical item
            old_can_val = {
                "review_status": canonical_item.review_status,
                "payload": canonical_item.payload_json,
            }
            canonical_item.payload_json = can_payload
            canonical_item.edited_by_human = True

            # 4. Update source item to merged status and reference canonical
            old_src_val = {
                "review_status": source_item.review_status,
                "duplicate_of": source_item.duplicate_of,
            }
            source_item.review_status = "merged"
            source_item.duplicate_of = canonical_id
            source_item.edited_by_human = True

            # 5. Log audit review events
            ItemRepository.log_review_event(
                db=db,
                item_id=canonical_item.id,
                action="items_merged",
                actor=merge_in.actor,
                old_value=old_can_val,
                new_value={
                    "canonical_id": canonical_item.id,
                    "merged_source_id": source_item.id,
                    "payload": canonical_item.payload_json,
                },
            )
            ItemRepository.log_review_event(
                db=db,
                item_id=source_item.id,
                action="items_merged",
                actor=merge_in.actor,
                old_value=old_src_val,
                new_value={
                    "review_status": "merged",
                    "duplicate_of": canonical_id,
                },
            )

            # 6. Save resolution in duplicate_resolutions table
            client_id = canonical_item.meeting.client_id
            ItemRepository.save_duplicate_resolution(
                db=db,
                client_id=client_id,
                item1_id=canonical_id,
                item2_id=source_item.id,
                resolution="merged",
                canonical_item_id=canonical_id,
            )

            db.commit()
            db.refresh(canonical_item)
            db.refresh(source_item)

            return ItemMergeResponse(
                canonical_item=ItemService._to_response(canonical_item),
                source_item=ItemService._to_response(source_item),
                merged_at=datetime.now(UTC),
                notes=f"Merged source task '{source_item.id}' into canonical task '{canonical_id}'.",
            )
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def split_item(
        db: Session,
        item_id: str,
        split_in: ItemSplitRequest,
    ) -> ItemSplitResponse:
        """Split an action item into two distinct sub-items in an atomic transaction."""
        original = ItemRepository.get_by_id(db, item_id)
        if not original:
            raise EntityNotFoundError(f"Item with ID '{item_id}' not found.")

        try:
            orig_payload = copy.deepcopy(original.payload_json or {})
            orig_evidence = orig_payload.get("evidence", [])

            # Create Sub-Item 1
            payload1 = {
                "id": generate_uuid(),
                "description": split_in.item1.description,
                "owner": {
                    "name": split_in.item1.owner_name,
                    "state": "stated" if split_in.item1.owner_name else "not_stated",
                },
                "due": {
                    "resolved_date": str(split_in.item1.due_date)
                    if split_in.item1.due_date
                    else None,
                    "state": "stated" if split_in.item1.due_date else "not_stated",
                },
                "priority": split_in.item1.priority or orig_payload.get("priority", "medium"),
                "confidence": orig_payload.get("confidence", "medium"),
                "evidence": orig_evidence,
                "split_from": original.id,
            }
            new_item_1 = ItemModel(
                meeting_id=original.meeting_id,
                item_type=original.item_type,
                payload_json=payload1,
                review_status="needs_review",
                edited_by_human=True,
            )
            db.add(new_item_1)

            # Create Sub-Item 2
            payload2 = {
                "id": generate_uuid(),
                "description": split_in.item2.description,
                "owner": {
                    "name": split_in.item2.owner_name,
                    "state": "stated" if split_in.item2.owner_name else "not_stated",
                },
                "due": {
                    "resolved_date": str(split_in.item2.due_date)
                    if split_in.item2.due_date
                    else None,
                    "state": "stated" if split_in.item2.due_date else "not_stated",
                },
                "priority": split_in.item2.priority or orig_payload.get("priority", "medium"),
                "confidence": orig_payload.get("confidence", "medium"),
                "evidence": orig_evidence,
                "split_from": original.id,
            }
            new_item_2 = ItemModel(
                meeting_id=original.meeting_id,
                item_type=original.item_type,
                payload_json=payload2,
                review_status="needs_review",
                edited_by_human=True,
            )
            db.add(new_item_2)

            db.flush()

            # Mark original item as merged/split and record lineage
            old_orig_val = {
                "review_status": original.review_status,
                "payload": original.payload_json,
            }
            orig_payload["split_into"] = [new_item_1.id, new_item_2.id]
            original.payload_json = orig_payload
            original.review_status = "merged"
            original.edited_by_human = True

            # Audit events
            ItemRepository.log_review_event(
                db=db,
                item_id=original.id,
                action="item_split",
                actor=split_in.actor,
                old_value=old_orig_val,
                new_value={
                    "review_status": "merged",
                    "split_into": [new_item_1.id, new_item_2.id],
                },
            )
            ItemRepository.log_review_event(
                db=db,
                item_id=new_item_1.id,
                action="item_created_from_split",
                actor=split_in.actor,
                old_value={"split_from": original.id},
                new_value={"item_id": new_item_1.id, "payload": payload1},
            )
            ItemRepository.log_review_event(
                db=db,
                item_id=new_item_2.id,
                action="item_created_from_split",
                actor=split_in.actor,
                old_value={"split_from": original.id},
                new_value={"item_id": new_item_2.id, "payload": payload2},
            )

            db.commit()
            db.refresh(original)
            db.refresh(new_item_1)
            db.refresh(new_item_2)

            return ItemSplitResponse(
                original_item=ItemService._to_response(original),
                item1=ItemService._to_response(new_item_1),
                item2=ItemService._to_response(new_item_2),
                split_at=datetime.now(UTC),
            )
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def resolve_duplicate(
        db: Session,
        client_id: str,
        resolve_in: DuplicateResolveRequest,
    ) -> DuplicateResolveResponse:
        """Resolve a duplicate pair by keeping both, merging, or discarding."""
        if resolve_in.item1_id == resolve_in.item2_id:
            raise InvalidInputError("Duplicate candidate items cannot reference the same item.")

        item1 = ItemRepository.get_by_id(db, resolve_in.item1_id)
        item2 = ItemRepository.get_by_id(db, resolve_in.item2_id)
        if not item1 or not item2:
            raise EntityNotFoundError("One or both items in duplicate candidate pair not found.")

        # Verify client match
        if (
            not item1.meeting
            or not item2.meeting
            or item1.meeting.client_id != client_id
            or item2.meeting.client_id != client_id
        ):
            raise InvalidInputError(
                "Both items must belong to the specified client organization."
            )

        valid_resolutions = ("keep_both", "merged", "discarded")
        if resolve_in.resolution not in valid_resolutions:
            raise InvalidInputError(
                f"Resolution must be one of {valid_resolutions}, got '{resolve_in.resolution}'."
            )

        # Check for cycles: prevent item1 pointing to item2 if item2 points to item1
        if resolve_in.resolution == "merged":
            canonical_id = resolve_in.canonical_item_id or resolve_in.item1_id
            source_id = (
                resolve_in.item2_id
                if canonical_id == resolve_in.item1_id
                else resolve_in.item1_id
            )
            # Merge
            ItemService.merge_items(
                db=db,
                canonical_id=canonical_id,
                merge_in=ItemMergeRequest(
                    source_item_id=source_id,
                    actor=resolve_in.actor,
                ),
            )
        else:
            # Audit log for keep_both or discarded
            action_name = (
                "duplicate_kept"
                if resolve_in.resolution == "keep_both"
                else "duplicate_discarded"
            )
            ItemRepository.log_review_event(
                db=db,
                item_id=resolve_in.item1_id,
                action=action_name,
                actor=resolve_in.actor,
                new_value={
                    "counterpart_id": resolve_in.item2_id,
                    "resolution": resolve_in.resolution,
                },
            )
            ItemRepository.log_review_event(
                db=db,
                item_id=resolve_in.item2_id,
                action=action_name,
                actor=resolve_in.actor,
                new_value={
                    "counterpart_id": resolve_in.item1_id,
                    "resolution": resolve_in.resolution,
                },
            )

        res = ItemRepository.save_duplicate_resolution(
            db=db,
            client_id=client_id,
            item1_id=resolve_in.item1_id,
            item2_id=resolve_in.item2_id,
            resolution=resolve_in.resolution,
            canonical_item_id=resolve_in.canonical_item_id,
        )

        return DuplicateResolveResponse(
            id=res.id,
            client_id=res.client_id,
            item1_id=res.item1_id,
            item2_id=res.item2_id,
            resolution=res.resolution,
            status="resolved",
            updated_at=res.updated_at,
        )

    @staticmethod
    def delete_item(db: Session, item_id: str) -> None:
        item = ItemRepository.get_by_id(db, item_id)
        if not item:
            raise EntityNotFoundError(f"Item with ID '{item_id}' not found.")
        ItemRepository.delete(db, item_id)
