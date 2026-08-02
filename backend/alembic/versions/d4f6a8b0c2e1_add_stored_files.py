"""Add stored files

Revision ID: d4f6a8b0c2e1
Revises: c2d4e6f8a0b1
Create Date: 2026-07-30

"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

revision = "d4f6a8b0c2e1"
down_revision = "c2d4e6f8a0b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stored_file",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "object_key",
            sqlmodel.sql.sqltypes.AutoString(length=500),
            nullable=False,
        ),
        sa.Column(
            "filename",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column(
            "content_type",
            sqlmodel.sql.sqltypes.AutoString(length=255),
            nullable=False,
        ),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column(
            "uploaded",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_key"),
    )

    op.create_index(
        "ix_stored_file_owner_created_at",
        "stored_file",
        ["owner_id", "created_at"],
    )

    op.create_table(
        "conversation_file",
        sa.Column("stored_file_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversation.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["stored_file_id"], ["stored_file.id"]),
        sa.PrimaryKeyConstraint("stored_file_id"),
    )

    op.create_index(
        "ix_conversation_file_conversation",
        "conversation_file",
        ["conversation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_conversation_file_conversation",
        table_name="conversation_file",
    )

    op.drop_table("conversation_file")

    op.drop_index(
        "ix_stored_file_owner_created_at",
        table_name="stored_file",
    )

    op.drop_table("stored_file")
