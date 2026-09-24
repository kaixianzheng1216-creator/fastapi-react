"""Add projects, membership and project-scoped knowledge keys."""

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision = "000000000009"
down_revision = "000000000008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建默认项目，承接迁移前的所有知识库。
    project = op.create_table(
        "project",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    now = datetime.now(UTC)
    op.bulk_insert(
        project,
        [
            {
                "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
                "name": "默认项目",
                "description": None,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    # 成员关系从空表开始，不自动授予旧用户项目权限。
    op.create_table(
        "project_member",
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("project.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("user.id"), primary_key=True),
        sa.Column(
            "role",
            sa.Enum(
                "admin",
                "member",
                name="project_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 先回填旧知识库的项目，再将 project_id 设为必填。
    op.add_column("knowledge_base", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.execute(
        "UPDATE knowledge_base SET project_id = '00000000-0000-0000-0000-000000000001'"
    )
    op.alter_column("knowledge_base", "project_id", nullable=False)
    op.create_foreign_key(
        "fk_knowledge_base_project", "knowledge_base", "project", ["project_id"], ["id"]
    )
    # 知识库名称由全局唯一改为项目内唯一。
    op.drop_constraint("knowledge_base_name_key", "knowledge_base", type_="unique")
    op.create_unique_constraint(
        "uq_knowledge_base_project_name", "knowledge_base", ["project_id", "name"]
    )

    # 旧 MCP 密钥作废；此后只创建项目密钥。
    op.execute("DELETE FROM mcp_api_key")
    op.drop_constraint("mcp_scope", "mcp_api_key", type_="check")
    op.drop_column("mcp_api_key", "scope")

    op.add_column("mcp_api_key", sa.Column("project_id", sa.Uuid(), nullable=False))
    op.add_column("mcp_api_key", sa.Column("created_by", sa.Uuid(), nullable=False))
    op.add_column("mcp_api_key", sa.Column("permission", sa.String(10), nullable=False))
    op.create_foreign_key(
        "fk_mcp_key_project",
        "mcp_api_key",
        "project",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_mcp_key_creator", "mcp_api_key", "user", ["created_by"], ["id"]
    )
    op.create_check_constraint(
        "mcp_permission", "mcp_api_key", "permission IN ('read_only', 'read_write')"
    )


def downgrade() -> None:
    # 旧结构要求知识库名称全局唯一；先检查，避免回滚到一半才失败。
    duplicate_name = (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT name FROM knowledge_base GROUP BY name HAVING count(*) > 1 LIMIT 1"
            )
        )
        .scalar()
    )
    if duplicate_name is not None:
        raise RuntimeError("回滚前请先处理不同项目中的同名知识库")

    op.create_unique_constraint("knowledge_base_name_key", "knowledge_base", ["name"])

    # 项目密钥无法放入旧结构，回滚时同样作废。
    op.execute("DELETE FROM mcp_api_key")
    op.drop_constraint("mcp_permission", "mcp_api_key", type_="check")
    op.drop_constraint("fk_mcp_key_creator", "mcp_api_key", type_="foreignkey")
    op.drop_constraint("fk_mcp_key_project", "mcp_api_key", type_="foreignkey")
    op.drop_column("mcp_api_key", "permission")
    op.drop_column("mcp_api_key", "created_by")
    op.drop_column("mcp_api_key", "project_id")
    op.add_column(
        "mcp_api_key",
        sa.Column(
            "scope",
            sa.Enum("internal", "external", name="mcp_scope", native_enum=False),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        "mcp_scope", "mcp_api_key", "scope IN ('internal', 'external')"
    )

    op.drop_constraint(
        "uq_knowledge_base_project_name", "knowledge_base", type_="unique"
    )
    op.drop_constraint(
        "fk_knowledge_base_project", "knowledge_base", type_="foreignkey"
    )
    op.drop_column("knowledge_base", "project_id")
    op.drop_table("project_member")
    op.drop_table("project")
