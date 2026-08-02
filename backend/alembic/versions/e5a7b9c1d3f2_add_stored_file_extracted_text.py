"""Add extracted text to stored files

Revision ID: e5a7b9c1d3f2
Revises: d4f6a8b0c2e1
Create Date: 2026-07-31

"""

import sqlalchemy as sa
from alembic import op

revision = "e5a7b9c1d3f2"
down_revision = "d4f6a8b0c2e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stored_file", sa.Column("extracted_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("stored_file", "extracted_text")
