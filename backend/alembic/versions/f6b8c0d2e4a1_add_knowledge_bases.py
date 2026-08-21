"""Add knowledge bases

Revision ID: f6b8c0d2e4a1
Revises: e5a7b9c1d3f2
Create Date: 2026-08-21

"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

revision = "f6b8c0d2e4a1"
down_revision = "e5a7b9c1d3f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_base",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "name",
            sqlmodel.sql.sqltypes.AutoString(length=100),
            nullable=False,
        ),
        sa.Column(
            "description",
            sqlmodel.sql.sqltypes.AutoString(length=500),
            nullable=True,
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("knowledge_base")
