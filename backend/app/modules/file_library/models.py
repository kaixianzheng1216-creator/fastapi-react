import uuid

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class FileLibrary(TimestampMixin, table=True):
    __tablename__ = "file_library"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    description: str | None = Field(default=None, max_length=500)


class LibraryFolder(TimestampMixin, table=True):
    __tablename__ = "library_folder"
    __table_args__ = (
        ForeignKeyConstraint(
            ["file_library_id", "parent_id"],
            ["library_folder.file_library_id", "library_folder.id"],
            name="fk_library_folder_parent",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "file_library_id",
            "id",
            name="uq_library_folder_file_library_id_id",
        ),
        UniqueConstraint(
            "file_library_id",
            "parent_id",
            "name",
            name="uq_library_folder_parent_name",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_library_id: uuid.UUID = Field(
        foreign_key="file_library.id",
        ondelete="CASCADE",
    )
    parent_id: uuid.UUID | None = None
    name: str = Field(max_length=100)


class LibraryDocument(TimestampMixin, table=True):
    __tablename__ = "library_document"
    __table_args__ = (
        ForeignKeyConstraint(
            ["file_library_id", "folder_id"],
            ["library_folder.file_library_id", "library_folder.id"],
            name="fk_library_document_folder",
            ondelete="CASCADE",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_library_id: uuid.UUID = Field(
        foreign_key="file_library.id",
        ondelete="CASCADE",
    )
    folder_id: uuid.UUID | None = None
    stored_file_id: uuid.UUID = Field(
        foreign_key="stored_file.id",
        unique=True,
    )
