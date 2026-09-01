"""Add resumable agent run lifecycle.

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-09-01

"""

import sqlalchemy as sa

from alembic import op

revision = "000000000002"
down_revision = "000000000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_run",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["conversation.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed', 'cancelled')",
            name="ck_agent_run_status",
        ),
        sa.CheckConstraint(
            "(status IN ('queued', 'running') AND request_payload IS NOT NULL) "
            "OR (status IN ('completed', 'failed', 'cancelled') "
            "AND request_payload IS NULL)",
            name="ck_agent_run_request_payload",
        ),
    )
    op.create_index(
        "uq_agent_run_active_conversation",
        "agent_run",
        ["conversation_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('queued', 'running')"),
    )


def downgrade() -> None:
    op.drop_table("agent_run")
