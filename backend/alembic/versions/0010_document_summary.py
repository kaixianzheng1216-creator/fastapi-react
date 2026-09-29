"""Add the generated summary to knowledge documents."""

import sqlalchemy as sa

from alembic import op

revision = "000000000010"
down_revision = "000000000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("knowledge_document", sa.Column("summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("knowledge_document", "summary")
