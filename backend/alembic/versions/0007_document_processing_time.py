"""Record document processing timestamps."""

import sqlalchemy as sa

from alembic import op

revision = "000000000007"
down_revision = "000000000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_document",
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "knowledge_document",
        sa.Column("processing_finished_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("knowledge_document", "processing_finished_at")
    op.drop_column("knowledge_document", "processing_started_at")
