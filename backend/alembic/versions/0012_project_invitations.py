"""项目邀请链接。"""

import sqlalchemy as sa
from alembic import op

revision = "000000000012"
down_revision = "000000000011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_invitation",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("project.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("user.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_project_invitation_project_id", "project_invitation", ["project_id"]
    )


def downgrade() -> None:
    op.drop_table("project_invitation")
