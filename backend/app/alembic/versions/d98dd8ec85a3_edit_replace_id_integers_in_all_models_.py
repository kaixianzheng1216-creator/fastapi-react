"""Edit replace id integers in all models to use UUID instead

Revision ID: d98dd8ec85a3
Revises: 9c0a54914c78
Create Date: 2024-07-19 04:08:04.000976

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


# 版本标识符，由 Alembic 使用。
revision = 'd98dd8ec85a3'
down_revision = '9c0a54914c78'
branch_labels = None
depends_on = None


def upgrade():
    # 确保 uuid-ossp 扩展可用
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # 创建带默认 UUID 值的新 UUID 列
    op.add_column('user', sa.Column('new_id', postgresql.UUID(as_uuid=True), default=sa.text('uuid_generate_v4()')))
    op.add_column('item', sa.Column('new_id', postgresql.UUID(as_uuid=True), default=sa.text('uuid_generate_v4()')))
    op.add_column('item', sa.Column('new_owner_id', postgresql.UUID(as_uuid=True), nullable=True))

    # 用 UUID 填充新列
    op.execute('UPDATE "user" SET new_id = uuid_generate_v4()')
    op.execute('UPDATE item SET new_id = uuid_generate_v4()')
    op.execute('UPDATE item SET new_owner_id = (SELECT new_id FROM "user" WHERE "user".id = item.owner_id)')

    # 将 new_id 设为非空
    op.alter_column('user', 'new_id', nullable=False)
    op.alter_column('item', 'new_id', nullable=False)

    # 删除旧列并重命名新列
    op.drop_constraint('item_owner_id_fkey', 'item', type_='foreignkey')
    op.drop_column('item', 'owner_id')
    op.alter_column('item', 'new_owner_id', new_column_name='owner_id')

    op.drop_column('user', 'id')
    op.alter_column('user', 'new_id', new_column_name='id')

    op.drop_column('item', 'id')
    op.alter_column('item', 'new_id', new_column_name='id')

    # 创建主键约束
    op.create_primary_key('user_pkey', 'user', ['id'])
    op.create_primary_key('item_pkey', 'item', ['id'])

    # 重建外键约束
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', ['owner_id'], ['id'])

def downgrade():
    # 反向执行升级过程
    op.add_column('user', sa.Column('old_id', sa.Integer, autoincrement=True))
    op.add_column('item', sa.Column('old_id', sa.Integer, autoincrement=True))
    op.add_column('item', sa.Column('old_owner_id', sa.Integer, nullable=True))

    # 用默认值填充旧列
    # 如果序列不存在则生成整数 ID 的序列
    op.execute('CREATE SEQUENCE IF NOT EXISTS user_id_seq AS INTEGER OWNED BY "user".old_id')
    op.execute('CREATE SEQUENCE IF NOT EXISTS item_id_seq AS INTEGER OWNED BY item.old_id')

    op.execute('SELECT setval(\'user_id_seq\', COALESCE((SELECT MAX(old_id) + 1 FROM "user"), 1), false)')
    op.execute('SELECT setval(\'item_id_seq\', COALESCE((SELECT MAX(old_id) + 1 FROM item), 1), false)')

    op.execute('UPDATE "user" SET old_id = nextval(\'user_id_seq\')')
    op.execute('UPDATE item SET old_id = nextval(\'item_id_seq\'), old_owner_id = (SELECT old_id FROM "user" WHERE "user".id = item.owner_id)')

    # 删除新列并将旧列名改回
    op.drop_constraint('item_owner_id_fkey', 'item', type_='foreignkey')
    op.drop_column('item', 'owner_id')
    op.alter_column('item', 'old_owner_id', new_column_name='owner_id')

    op.drop_column('user', 'id')
    op.alter_column('user', 'old_id', new_column_name='id')

    op.drop_column('item', 'id')
    op.alter_column('item', 'old_id', new_column_name='id')

    # 创建主键约束
    op.create_primary_key('user_pkey', 'user', ['id'])
    op.create_primary_key('item_pkey', 'item', ['id'])

    # 重建外键约束
    op.create_foreign_key('item_owner_id_fkey', 'item', 'user', ['owner_id'], ['id'])
