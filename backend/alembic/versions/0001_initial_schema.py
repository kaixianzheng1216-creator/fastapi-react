"""Create initial schema.

Revision ID: 000000000001
Revises:
Create Date: 2026-08-23

"""

import sqlalchemy as sa
from alembic import op

revision = "000000000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 用户
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )

    # 会话
    op.create_table(
        "conversation",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
    )

    # 共享文件
    op.create_table(
        "stored_file",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("uploaded", sa.Boolean(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"]),
        sa.UniqueConstraint("object_key"),
    )

    # 会话文件关联
    op.create_table(
        "conversation_file",
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("stored_file_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("stored_file_id"),
        sa.ForeignKeyConstraint(["conversation_id"], ["conversation.id"]),
        sa.ForeignKeyConstraint(["stored_file_id"], ["stored_file.id"]),
    )

    # 知识库
    op.create_table(
        "knowledge_base",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "knowledge_folder",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_base_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"],
            ["knowledge_base.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id", "parent_id"],
            ["knowledge_folder.knowledge_base_id", "knowledge_folder.id"],
            name="fk_knowledge_folder_parent",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "knowledge_base_id",
            "id",
            name="uq_knowledge_folder_knowledge_base_id_id",
        ),
        sa.UniqueConstraint(
            "knowledge_base_id",
            "parent_id",
            "name",
            name="uq_knowledge_folder_parent_name",
            postgresql_nulls_not_distinct=True,
        ),
    )

    op.create_table(
        "knowledge_document",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("knowledge_base_id", sa.Uuid(), nullable=False),
        sa.Column("folder_id", sa.Uuid(), nullable=True),
        sa.Column("stored_file_id", sa.Uuid(), nullable=False),
        sa.Column("source_url", sa.String(length=2083), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"],
            ["knowledge_base.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id", "folder_id"],
            ["knowledge_folder.knowledge_base_id", "knowledge_folder.id"],
            name="fk_knowledge_document_folder",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["stored_file_id"], ["stored_file.id"]),
        sa.UniqueConstraint("stored_file_id"),
    )
    # 品牌营销
    op.create_table(
        "province_annual_indicator",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("province_code", sa.String(length=6), nullable=False),
        sa.Column("province_name", sa.String(length=50), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("indicator_code", sa.String(length=50), nullable=False),
        sa.Column("value", sa.Numeric(precision=20, scale=4), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "province_code",
            "year",
            "indicator_code",
            name="uq_province_annual_indicator_dimension",
        ),
    )

    # 内容运营
    op.create_table(
        "bilibili_ranking_snapshot",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "bilibili_ranking_item",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("ranking_category_code", sa.String(length=20), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("bvid", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author_name", sa.String(length=100), nullable=False),
        sa.Column("content_category_name", sa.String(length=50), nullable=False),
        sa.Column("cover_url", sa.String(length=500), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("view_count", sa.BigInteger(), nullable=False),
        sa.Column("danmaku_count", sa.BigInteger(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["bilibili_ranking_snapshot.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "snapshot_id",
            "ranking_category_code",
            "rank",
            name="uq_bilibili_ranking_item_rank",
        ),
        sa.UniqueConstraint(
            "snapshot_id",
            "ranking_category_code",
            "bvid",
            name="uq_bilibili_ranking_item_bvid",
        ),
    )

    # 达人投放
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
        sa.Column("profile_url", sa.String(length=500), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("location", sa.String(length=50), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("followers", sa.BigInteger(), nullable=False),
        sa.Column("engagement_count", sa.BigInteger(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["influencer_account_snapshot.id"],
            ondelete="CASCADE",
        ),
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
    op.drop_table("bilibili_ranking_item")
    op.drop_table("bilibili_ranking_snapshot")
    op.drop_table("province_annual_indicator")
    op.drop_table("knowledge_document")
    op.drop_table("knowledge_folder")
    op.drop_table("knowledge_base")
    op.drop_table("conversation_file")
    op.drop_table("stored_file")
    op.drop_table("conversation")
    op.drop_table("user")
