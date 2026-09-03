"""Add the conversation kind.

Revision ID: 000000000004
Revises: 000000000003
Create Date: 2026-09-02

"""

import sqlalchemy as sa

from alembic import op

revision = "000000000004"
down_revision = "000000000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversation",
        sa.Column(
            "kind",
            sa.Enum(
                "chat",
                "research",
                name="conversation_kind",
                native_enum=False,
                length=16,
            ),
            nullable=False,
            server_default="chat",
        ),
    )


def downgrade() -> None:
    op.drop_column("conversation", "kind")
