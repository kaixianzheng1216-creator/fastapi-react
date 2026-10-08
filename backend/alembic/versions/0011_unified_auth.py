"""用统一身份映射替代密码凭证。"""

import sqlalchemy as sa
from alembic import op

revision = "000000000011"
down_revision = "000000000010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("auth_user_id", sa.String(255), nullable=True))
    op.create_unique_constraint("uq_user_auth_user_id", "user", ["auth_user_id"])
    op.drop_column("user", "hashed_password")


def downgrade() -> None:
    raise RuntimeError("密码凭证已删除；如需回退认证方式，请恢复数据库备份。")
