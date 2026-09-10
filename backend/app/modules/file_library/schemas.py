import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import StringConstraints, field_validator, model_validator
from sqlmodel import Field, SQLModel

FileLibraryName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]

LibraryFolderName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class FileLibraryCreate(SQLModel):
    name: FileLibraryName
    description: str | None = Field(
        default=None,
        max_length=500,
    )


class FileLibraryUpdate(SQLModel):
    name: FileLibraryName | None = None
    description: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: FileLibraryName | None) -> FileLibraryName:
        if value is None:
            raise ValueError("文件库名称不能为空")

        return value


class FileLibraryPublic(SQLModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class FileLibrariesPublic(SQLModel):
    data: list[FileLibraryPublic]
    count: int


class LibraryFolderCreate(SQLModel):
    name: LibraryFolderName
    parent_id: uuid.UUID | None = None


class LibraryFolderUpdate(SQLModel):
    name: LibraryFolderName


class LibraryFolderMove(SQLModel):
    parent_id: uuid.UUID | None


class LibraryFolderPublic(SQLModel):
    id: uuid.UUID
    file_library_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    created_at: datetime
    updated_at: datetime


class LibraryFoldersPublic(SQLModel):
    data: list[LibraryFolderPublic]
    count: int


class LibraryDocumentMove(SQLModel):
    folder_id: uuid.UUID | None


class LibraryDocumentUploadPublic(SQLModel):
    id: uuid.UUID
    upload_url: str = Field(
        serialization_alias="uploadUrl",
    )
    upload_headers: dict[str, str] = Field(
        serialization_alias="uploadHeaders",
    )


class LibraryDocumentPublic(SQLModel):
    id: uuid.UUID
    file_library_id: uuid.UUID
    folder_id: uuid.UUID | None
    filename: str
    content_type: str
    size: int
    uploaded: bool
    created_at: datetime
    updated_at: datetime


class LibraryFolderEntryPublic(LibraryFolderPublic):
    type: Literal["folder"]


class LibraryDocumentEntryPublic(LibraryDocumentPublic):
    type: Literal["document"]


LibraryDirectoryEntryPublic = Annotated[
    LibraryFolderEntryPublic | LibraryDocumentEntryPublic,
    Field(discriminator="type"),
]


class LibraryDirectoryDelete(SQLModel):
    folder_ids: set[uuid.UUID] = Field(
        default_factory=set,
    )
    document_ids: set[uuid.UUID] = Field(
        default_factory=set,
    )

    @model_validator(mode="after")
    def validate_entries(self) -> LibraryDirectoryDelete:
        if not self.folder_ids and not self.document_ids:
            raise ValueError("至少选择一个文件夹或文件")

        return self


class LibraryDirectoryPublic(SQLModel):
    data: list[LibraryDirectoryEntryPublic]
    count: int
