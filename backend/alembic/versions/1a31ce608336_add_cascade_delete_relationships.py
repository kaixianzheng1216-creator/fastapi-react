"""Add cascade delete relationships

Revision ID: 1a31ce608336
Revises: d98dd8ec85a3
Create Date: 2024-07-31 22:24:34.447891

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# 版本标识符，由 Alembic 使用。
revision = '1a31ce608336'
down_revision = 'd98dd8ec85a3'
branch_labels = None
depends_on = None


def upgrade():
    # ### Alembic 自动生成的命令 - 请酌情调整！ ###
    op.alter_column('item', 'owner_id',
               existing_type=sa.UUID(),
               nullable=False)
    op.drop_constraint('item_owner_id_fkey', 'item', type_='foreignkey')
    op.create_foreign_key(None, 'item', 'user', ['owner_id'], ['id'], ondelete='CASCADE')
    # ### Alembic 命令结束 ###


def downgrade():
    # ### Alembic 自动生成的命令 - 请酌情调整！ ###
    op.drop_constraint('item_owner_id_fkey', 'item', type_='foreignkey')
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', ['owner_id'], ['id'])
    op.alter_column('item', 'owner_id',
               existing_type=sa.UUID(),
               nullable=True)
    # ### Alembic 命令结束 ###
