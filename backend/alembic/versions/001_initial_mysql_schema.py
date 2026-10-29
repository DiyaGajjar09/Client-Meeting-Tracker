"""Initial MySQL schema for Client Meeting-to-Action Tracker

Revision ID: 001_initial_mysql_schema
Revises:
Create Date: 2026-10-28 17:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "001_initial_mysql_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Clients Table
    op.create_table(
        "clients",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_clients_name", "clients", ["name"], unique=True)

    # 2. Meetings Table
    op.create_table(
        "meetings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("meeting_date", sa.Date(), nullable=True),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("raw_text", mysql.MEDIUMTEXT(), nullable=False),
        sa.Column("attendees", mysql.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_meetings_client_id", "meetings", ["client_id"], unique=False)
    op.create_index(
        "idx_meetings_meeting_date", "meetings", ["meeting_date"], unique=False
    )
    op.create_index("idx_meetings_created_at", "meetings", ["created_at"], unique=False)
    op.create_index(
        "idx_meetings_client_date",
        "meetings",
        ["client_id", "meeting_date"],
        unique=False,
    )

    # 3. Items Table
    op.create_table(
        "items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("meeting_id", sa.String(length=36), nullable=False),
        sa.Column("item_type", sa.String(length=50), nullable=False),
        sa.Column("payload_json", mysql.JSON(), nullable=False),
        sa.Column(
            "review_status",
            sa.String(length=50),
            server_default="needs_review",
            nullable=False,
        ),
        sa.Column(
            "edited_by_human", sa.Boolean(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("duplicate_of", sa.String(length=36), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["duplicate_of"], ["items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_items_meeting_id", "items", ["meeting_id"], unique=False)
    op.create_index("idx_items_item_type", "items", ["item_type"], unique=False)
    op.create_index("idx_items_review_status", "items", ["review_status"], unique=False)
    op.create_index("idx_items_duplicate_of", "items", ["duplicate_of"], unique=False)
    op.create_index(
        "idx_items_meeting_type_status",
        "items",
        ["meeting_id", "item_type", "review_status"],
        unique=False,
    )

    # 4. Review Events Table
    op.create_table(
        "review_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("old_value", mysql.JSON(), nullable=True),
        sa.Column("new_value", mysql.JSON(), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(
        "idx_review_events_item_id", "review_events", ["item_id"], unique=False
    )
    op.create_index(
        "idx_review_events_timestamp", "review_events", ["timestamp"], unique=False
    )

    # 5. Runs Table
    op.create_table(
        "runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("meeting_id", sa.String(length=36), nullable=False),
        sa.Column("model_name", sa.String(length=100), nullable=True),
        sa.Column("prompt_version", sa.String(length=50), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=True),
        sa.Column("tokens_out", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "validation_ok", sa.Boolean(), server_default=sa.text("1"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_runs_meeting_id", "runs", ["meeting_id"], unique=False)
    op.create_index("idx_runs_created_at", "runs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_table("runs")
    op.drop_table("review_events")
    op.drop_table("items")
    op.drop_table("meetings")
    op.drop_table("clients")
