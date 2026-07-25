"""Add conversations

Revision ID: b7e1d0c4a2f8
Revises: a4f3c2d1e0b9
Create Date: 2026-07-25

"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

revision = "b7e1d0c4a2f8"
down_revision = "a4f3c2d1e0b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "conversation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "title",
            sqlmodel.sql.sqltypes.AutoString(length=100),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_conversation_owner_updated_at",
        "conversation",
        ["owner_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_conversation_owner_updated_at",
        table_name="conversation",
    )
    op.drop_table("conversation")
