"""Add knowledge documents

Revision ID: a7c9e1f3b5d7
Revises: f6b8c0d2e4a1
Create Date: 2026-08-21

"""

import sqlalchemy as sa
import sqlmodel.sql.sqltypes

from alembic import op

revision = "a7c9e1f3b5d7"
down_revision = "f6b8c0d2e4a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_document",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_base_id", sa.Uuid(), nullable=False),
        sa.Column("stored_file_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sqlmodel.sql.sqltypes.AutoString(length=20),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "processing_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'ready', 'failed', 'timed_out')",
            name="ck_knowledge_document_status",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"],
            ["knowledge_base.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["stored_file_id"], ["stored_file.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("stored_file_id"),
    )
    op.create_index(
        "ix_knowledge_document_knowledge_base_created_at",
        "knowledge_document",
        ["knowledge_base_id", "created_at"],
    )
    op.create_index(
        "ix_knowledge_document_status_created_at",
        "knowledge_document",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_document_status_created_at",
        table_name="knowledge_document",
    )
    op.drop_index(
        "ix_knowledge_document_knowledge_base_created_at",
        table_name="knowledge_document",
    )
    op.drop_table("knowledge_document")
