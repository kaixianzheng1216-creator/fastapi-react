"""Add agent run timing and error details.

Revision ID: 000000000005
Revises: 000000000004
Create Date: 2026-09-04

"""

import sqlalchemy as sa

from alembic import op

revision = "000000000005"
down_revision = "000000000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_run",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "agent_run",
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "agent_run",
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    op.execute("UPDATE agent_run SET started_at = created_at")
    op.execute(
        "UPDATE agent_run SET finished_at = updated_at "
        "WHERE status IN ('completed', 'failed', 'cancelled')"
    )


def downgrade() -> None:
    op.drop_column("agent_run", "error_message")
    op.drop_column("agent_run", "finished_at")
    op.drop_column("agent_run", "started_at")
