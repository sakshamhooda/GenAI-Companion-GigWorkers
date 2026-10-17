"""Google sign-in: users.google_sub, users.email; phone becomes optional.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("google_sub", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("email", sa.String(length=255), nullable=True))
        batch.alter_column("phone", existing_type=sa.String(length=20), nullable=True)
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)
    op.create_index("ix_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_google_sub", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.alter_column("phone", existing_type=sa.String(length=20), nullable=False)
        batch.drop_column("email")
        batch.drop_column("google_sub")
