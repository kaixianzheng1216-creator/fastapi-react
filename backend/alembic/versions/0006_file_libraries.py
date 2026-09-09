"""Add file libraries and folders without document processing."""

import sqlalchemy as sa
from alembic import op

revision = "000000000006"
down_revision = "000000000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "file_library",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "library_folder",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_library_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["file_library_id"],
            ["file_library.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_library_id", "parent_id"],
            ["library_folder.file_library_id", "library_folder.id"],
            name="fk_library_folder_parent",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "file_library_id",
            "id",
            name="uq_library_folder_file_library_id_id",
        ),
        sa.UniqueConstraint(
            "file_library_id",
            "parent_id",
            "name",
            name="uq_library_folder_parent_name",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_table(
        "library_document",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_library_id", sa.Uuid(), nullable=False),
        sa.Column("folder_id", sa.Uuid(), nullable=True),
        sa.Column("stored_file_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["file_library_id"],
            ["file_library.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_library_id", "folder_id"],
            ["library_folder.file_library_id", "library_folder.id"],
            name="fk_library_document_folder",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["stored_file_id"], ["stored_file.id"]),
        sa.UniqueConstraint("stored_file_id"),
    )


def downgrade() -> None:
    op.drop_table("library_document")
    op.drop_table("library_folder")
    op.drop_table("file_library")
