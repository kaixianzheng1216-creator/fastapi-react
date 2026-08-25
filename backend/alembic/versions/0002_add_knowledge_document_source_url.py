"""Add knowledge document source URL.

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-08-25

"""

import sqlalchemy as sa
from alembic import op

revision = "000000000002"
down_revision = "000000000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_document",
        sa.Column("source_url", sa.String(length=2083), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_document", "source_url")
