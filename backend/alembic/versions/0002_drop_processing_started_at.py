"""Drop unused knowledge document processing timestamp.

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-08-24

"""

import sqlalchemy as sa
from alembic import op

revision = "000000000002"
down_revision = "000000000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("knowledge_document", "processing_started_at")


def downgrade() -> None:
    op.add_column(
        "knowledge_document",
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
    )
