"""Add the conversation deleting marker.

Revision ID: 000000000003
Revises: 000000000002
Create Date: 2026-09-02

"""

import sqlalchemy as sa

from alembic import op

revision = "000000000003"
down_revision = "000000000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversation",
        sa.Column("deleting_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversation", "deleting_at")
