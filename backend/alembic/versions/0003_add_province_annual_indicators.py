"""Add province annual indicators.

Revision ID: 000000000003
Revises: 000000000002
Create Date: 2026-08-25

"""

import sqlalchemy as sa
from alembic import op

revision = "000000000003"
down_revision = "000000000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dwd_province_annual_indicator",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("indicator_code", sa.String(length=50), nullable=False),
        sa.Column("province_code", sa.String(length=6), nullable=False),
        sa.Column("province_name", sa.String(length=50), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("dwd_province_annual_indicator")
