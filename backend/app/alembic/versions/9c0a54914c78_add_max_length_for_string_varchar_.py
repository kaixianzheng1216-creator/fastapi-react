"""Add max length for string(varchar) fields in User and Items models

Revision ID: 9c0a54914c78
Revises: e2412789c190
Create Date: 2024-06-17 14:42:44.639457

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# 版本标识符，由 Alembic 使用。
revision = '9c0a54914c78'
down_revision = 'e2412789c190'
branch_labels = None
depends_on = None


def upgrade():
    # 调整 User 表中 email 字段的长度
    op.alter_column('user', 'email',
               existing_type=sa.String(),
               type_=sa.String(length=255),
               existing_nullable=False)

    # 调整 User 表中 full_name 字段的长度
    op.alter_column('user', 'full_name',
               existing_type=sa.String(),
               type_=sa.String(length=255),
               existing_nullable=True)

    # 调整 Item 表中 title 字段的长度
    op.alter_column('item', 'title',
               existing_type=sa.String(),
               type_=sa.String(length=255),
               existing_nullable=False)

    # 调整 Item 表中 description 字段的长度
    op.alter_column('item', 'description',
               existing_type=sa.String(),
               type_=sa.String(length=255),
               existing_nullable=True)


def downgrade():
    # 恢复 User 表中 email 字段的长度
    op.alter_column('user', 'email',
               existing_type=sa.String(length=255),
               type_=sa.String(),
               existing_nullable=False)

    # 恢复 User 表中 full_name 字段的长度
    op.alter_column('user', 'full_name',
               existing_type=sa.String(length=255),
               type_=sa.String(),
               existing_nullable=True)

    # 恢复 Item 表中 title 字段的长度
    op.alter_column('item', 'title',
               existing_type=sa.String(length=255),
               type_=sa.String(),
               existing_nullable=False)

    # 恢复 Item 表中 description 字段的长度
    op.alter_column('item', 'description',
               existing_type=sa.String(length=255),
               type_=sa.String(),
               existing_nullable=True)
