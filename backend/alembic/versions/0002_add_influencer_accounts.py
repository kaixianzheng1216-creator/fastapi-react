"""Add influencer account snapshots.

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-08-27

"""

from alembic import op
import sqlalchemy as sa

revision = "000000000002"
down_revision = "000000000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "influencer_account_snapshot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "influencer_account",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("platform_uid", sa.String(length=128), nullable=False),
        sa.Column("public_account_id", sa.String(length=100), nullable=False),
        sa.Column("nickname", sa.String(length=255), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("profile_url", sa.String(length=500), nullable=False),
        sa.Column("location", sa.String(length=50), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("followers", sa.BigInteger(), nullable=False),
        sa.Column("engagement_count", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["influencer_account_snapshot.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "snapshot_id",
            "platform",
            "platform_uid",
            name="uq_influencer_account_snapshot_platform_uid",
        ),
    )


def downgrade() -> None:
    op.drop_table("influencer_account")
    op.drop_table("influencer_account_snapshot")
