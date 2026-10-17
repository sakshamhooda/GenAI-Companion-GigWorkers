"""Composite indexes for the per-user, time-ordered queries.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_earnings_user_date", "earnings", ["user_id", "date"])
    op.create_index("ix_messages_user_created", "messages", ["user_id", "created_at"])
    op.create_index("ix_grievances_user_created", "grievances", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_grievances_user_created", table_name="grievances")
    op.drop_index("ix_messages_user_created", table_name="messages")
    op.drop_index("ix_earnings_user_date", table_name="earnings")
