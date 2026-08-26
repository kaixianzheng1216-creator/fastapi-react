"""Add province indicator unique constraint.

Revision ID: 000000000004
Revises: 000000000003
Create Date: 2026-08-26

"""

from alembic import op

revision = "000000000004"
down_revision = "000000000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_province_annual_indicator_key",
        "dwd_province_annual_indicator",
        ["indicator_code", "province_code", "year"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_province_annual_indicator_key",
        "dwd_province_annual_indicator",
        type_="unique",
    )
