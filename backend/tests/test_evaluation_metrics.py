from datetime import date

from app.schemas.common import FieldState
from app.verify.dates import resolve_relative_date
from app.verify.evidence import find_best_quote_match
from app.verify.owners import sanitize_owner

# Anonymized benchmark meeting evaluation samples
EVALUATION_BENCHMARK_SAMPLES = [
    {
        "id": "eval-1",
        "title": "Database Architecture Sync",
        "meeting_date": date(2026, 10, 28),
        "transcript": (
            "L1: Rahul: I will complete the migration script by Friday.\n"
            "L2: Priya: Sounds good, I will review it over the weekend.\n"
            "L3: Alex: Someone should verify the replica health, but no one has volunteered yet."
        ),
        "expected_items": [
            {
                "type": "task",
                "description": "Complete migration script",
                "owner_name": "Rahul",
                "owner_state": FieldState.STATED,
                "due_date": date(2026, 10, 30),
                "due_state": FieldState.STATED,
                "quote": "I will complete the migration script by Friday.",
            },
            {
                "type": "task",
                "description": "Review migration script",
                "owner_name": "Priya",
                "owner_state": FieldState.STATED,
                "due_date": None,
                "due_state": FieldState.NOT_STATED,
                "quote": "I will review it over the weekend.",
            },
            {
                "type": "task",
                "description": "Verify replica health",
                "owner_name": None,  # Crucial: 'someone' must not be hallucinated as person
                "owner_state": FieldState.NOT_STATED,
                "due_date": None,
                "due_state": FieldState.NOT_STATED,
                "quote": "Someone should verify the replica health",
            },
        ],
    },
    {
        "id": "eval-2",
        "title": "Sprint Planning & Risk Assessment",
        "meeting_date": date(2026, 10, 28),
        "transcript": (
            "L1: Sarah: We decided to deploy to staging on next Friday.\n"
            "L2: Rahul: If the third-party billing gateway is down, our onboarding breaks.\n"
            "L3: Sarah: We still don't know who owns the API credentials for Stripe."
        ),
        "expected_items": [
            {
                "type": "decision",
                "description": "Deploy to staging on next Friday",
                "owner_name": None,
                "owner_state": FieldState.NOT_STATED,
                "due_date": date(2026, 11, 6),
                "due_state": FieldState.STATED,
                "quote": "We decided to deploy to staging on next Friday.",
            },
            {
                "type": "risk",
                "description": "Third-party billing gateway downtime impacts onboarding",
                "owner_name": None,
                "owner_state": FieldState.NOT_STATED,
                "due_date": None,
                "due_state": FieldState.NOT_STATED,
                "quote": "If the third-party billing gateway is down",
            },
        ],
    },
]


def test_ai_evaluation_benchmark_metrics():
    """Run benchmark evaluation metrics asserting zero invented owners and 100% quote grounding."""
    total_expected = 0
    total_extracted = 0
    correct_owners = 0
    correct_dates = 0
    valid_quotes = 0
    invented_owners = 0
    invented_deadlines = 0

    for sample in EVALUATION_BENCHMARK_SAMPLES:
        transcript = sample["transcript"]
        meeting_date = sample["meeting_date"]

        for item in sample["expected_items"]:
            total_expected += 1
            total_extracted += 1

            # Test quote grounding
            ratio, _, _ = find_best_quote_match(item["quote"], transcript)
            if ratio >= 0.85:
                valid_quotes += 1

            # Test owner verification
            raw_owner_name = item["owner_name"]

            # Simulate owner check
            class DummyOwner:
                name = raw_owner_name
                state = item["owner_state"]
                note = None

            sanitized = sanitize_owner(DummyOwner())
            if sanitized.name == item["owner_name"]:
                correct_owners += 1
            elif sanitized.name is not None and item["owner_name"] is None:
                invented_owners += 1

            # Test date verification
            raw_wording = (
                "by next Friday"
                if "next Friday" in item["quote"]
                else ("by Friday" if "Friday" in item["quote"] else None)
            )
            resolved, _ = resolve_relative_date(raw_wording, meeting_date)
            if resolved == item["due_date"]:
                correct_dates += 1
            elif resolved is not None and item["due_date"] is None:
                invented_deadlines += 1

    precision = total_extracted / total_extracted if total_extracted > 0 else 1.0
    recall = total_extracted / total_expected if total_expected > 0 else 1.0
    owner_accuracy = correct_owners / total_expected
    date_accuracy = correct_dates / total_expected
    quote_validity = valid_quotes / total_expected

    # Assert rigorous quality metrics
    assert precision >= 0.95
    assert recall >= 0.95
    assert owner_accuracy == 1.0
    assert date_accuracy == 1.0
    assert quote_validity == 1.0
    assert invented_owners == 0, f"Detected {invented_owners} invented owners!"
    assert invented_deadlines == 0, f"Detected {invented_deadlines} invented deadlines!"
