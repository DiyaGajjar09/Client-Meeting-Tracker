"""Add duplicate resolutions table and actor column to review_events

Revision ID: 002_review_duplicates_schema
Revises: 001_initial_mysql_schema
Create Date: 2026-10-28 19:15:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_review_duplicates_schema"
down_revision: str | None = "001_initial_mysql_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add actor column to review_events
    op.add_column("review_events", sa.Column("actor", sa.String(length=100), nullable=True))

    # 2. Create duplicate_resolutions table
    op.create_table(
        "duplicate_resolutions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("item1_id", sa.String(length=36), nullable=False),
        sa.Column("item2_id", sa.String(length=36), nullable=False),
        sa.Column("resolution", sa.String(length=50), nullable=False),
        sa.Column("canonical_item_id", sa.String(length=36), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item1_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item2_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["canonical_item_id"], ["items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(
        "idx_dup_res_pair", "duplicate_resolutions", ["item1_id", "item2_id"], unique=True
    )
    op.create_index(
        "idx_dup_res_client", "duplicate_resolutions", ["client_id", "resolution"], unique=False
    )


def downgrade() -> None:
    op.drop_index("idx_dup_res_client", table_name="duplicate_resolutions")
    op.drop_index("idx_dup_res_pair", table_name="duplicate_resolutions")
    op.drop_table("duplicate_resolutions")
    op.drop_column("review_events", "actor")

