"""Initial schema: users, earnings, messages, grievances.

Revision ID: 0001
Revises:
Create Date: 2026-10-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("pin_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="hi"),
        sa.Column("work_type", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("platform", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("city", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("memory", sa.Text(), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="worker"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)

    op.create_table(
        "earnings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("expenses", sa.Float(), nullable=False, server_default="0"),
        sa.Column("platform", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_earnings_user_id", "earnings", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False, server_default="web"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_messages_user_id", "messages", ["user_id"])

    op.create_table(
        "grievances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("draft_local", sa.Text(), nullable=False, server_default=""),
        sa.Column("draft_english", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_grievances_user_id", "grievances", ["user_id"])


def downgrade() -> None:
    op.drop_table("grievances")
    op.drop_table("messages")
    op.drop_table("earnings")
    op.drop_table("users")
