"""Add conversation archived

Revision ID: c2d4e6f8a0b1
Revises: b7e1d0c4a2f8
Create Date: 2026-07-25

"""

import sqlalchemy as sa

from alembic import op

revision = "c2d4e6f8a0b1"
down_revision = "b7e1d0c4a2f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "conversation",
        sa.Column(
            "archived",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("conversation", "archived")
