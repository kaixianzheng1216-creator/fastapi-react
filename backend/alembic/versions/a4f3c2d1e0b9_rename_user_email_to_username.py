"""Rename user email to username

Revision ID: a4f3c2d1e0b9
Revises: fe56fa70289e
Create Date: 2026-07-19

"""

import sqlalchemy as sa
from alembic import op

revision = "a4f3c2d1e0b9"
down_revision = "fe56fa70289e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Preserve existing login identifiers so current accounts keep working.
    op.drop_index("ix_user_email", table_name="user")
    op.alter_column(
        "user",
        "email",
        new_column_name="username",
        existing_type=sa.String(length=255),
        existing_nullable=False,
    )
    op.create_index("ix_user_username", "user", ["username"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_user_username", table_name="user")
    op.alter_column(
        "user",
        "username",
        new_column_name="email",
        existing_type=sa.String(length=255),
        existing_nullable=False,
    )
    op.create_index("ix_user_email", "user", ["email"], unique=True)
