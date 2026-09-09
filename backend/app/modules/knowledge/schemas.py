import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import HttpUrl, StringConstraints, field_validator, model_validator
from sqlmodel import Field, SQLModel

from app.modules.knowledge.models import KnowledgeDocumentStatus

KnowledgeBaseName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]

KnowledgeFolderName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class KnowledgeBaseCreate(SQLModel):
    name: KnowledgeBaseName = Field(description="知识库名称")
    description: str | None = Field(
        default=None,
        max_length=500,
        description="知识库描述",
    )


class KnowledgeBaseUpdate(SQLModel):
    name: KnowledgeBaseName | None = Field(default=None, description="知识库名称")
    description: str | None = Field(
        default=None,
        max_length=500,
        description="知识库描述",
    )
    is_enabled: bool | None = Field(
        default=None,
        description="是否启用知识库：true=启用，false=停用",
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: KnowledgeBaseName | None) -> KnowledgeBaseName:
        if value is None:
            raise ValueError("知识库名称不能为空")

        return value

    @field_validator("is_enabled")
    @classmethod
    def validate_is_enabled(cls, value: bool | None) -> bool:
        if value is None:
            raise ValueError("知识库状态不能为空")

        return value


class KnowledgeBasePublic(SQLModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_enabled: bool
    created_at: datetime
    updated_at: datetime


class KnowledgeBasesPublic(SQLModel):
    data: list[KnowledgeBasePublic]
    count: int


class KnowledgeBaseSummaryPublic(SQLModel):
    id: uuid.UUID
    name: str
    description: str | None


class KnowledgeBaseSummariesPublic(SQLModel):
    data: list[KnowledgeBaseSummaryPublic]
    count: int


class KnowledgeFolderCreate(SQLModel):
    name: KnowledgeFolderName = Field(description="文件夹名称")
    parent_id: uuid.UUID | None = Field(
        default=None,
        description="父文件夹 ID；不传表示创建在根目录",
    )


class KnowledgeFolderUpdate(SQLModel):
    name: KnowledgeFolderName = Field(description="新的文件夹名称")


class KnowledgeFolderMove(SQLModel):
    parent_id: uuid.UUID | None = Field(
        description="目标父文件夹 ID；传 null 表示移动到根目录"
    )


class KnowledgeFolderPublic(SQLModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    created_at: datetime
    updated_at: datetime


class KnowledgeFoldersPublic(SQLModel):
    data: list[KnowledgeFolderPublic]
    count: int


class KnowledgeWebpageCreate(SQLModel):
    url: HttpUrl = Field(description="需要导入的网页 URL")


class KnowledgeDocumentMove(SQLModel):
    folder_id: uuid.UUID | None


class KnowledgeDocumentUploadPublic(SQLModel):
    id: uuid.UUID = Field(description="文档 ID，上传完成后用于确认")
    upload_url: str = Field(
        serialization_alias="uploadUrl",
        description="用于上传文件内容的临时 HTTP PUT 地址",
    )
    upload_headers: dict[str, str] = Field(
        serialization_alias="uploadHeaders",
        description="上传文件时必须原样携带的 HTTP 请求头",
    )


class KnowledgeDocumentPublic(SQLModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    folder_id: uuid.UUID | None
    filename: str
    content_type: str
    size: int
    uploaded: bool
    source_url: str | None
    status: KnowledgeDocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class KnowledgeFolderEntryPublic(KnowledgeFolderPublic):
    type: Literal["folder"]


class KnowledgeDocumentEntryPublic(KnowledgeDocumentPublic):
    type: Literal["document"]


KnowledgeDirectoryEntryPublic = Annotated[
    KnowledgeFolderEntryPublic | KnowledgeDocumentEntryPublic,
    Field(discriminator="type"),
]


class KnowledgeDirectoryDelete(SQLModel):
    folder_ids: set[uuid.UUID] = Field(
        default_factory=set,
        description="需要删除的文件夹 ID 列表",
    )
    document_ids: set[uuid.UUID] = Field(
        default_factory=set,
        description="需要删除的文档 ID 列表",
    )

    @model_validator(mode="after")
    def validate_entries(self) -> KnowledgeDirectoryDelete:
        if not self.folder_ids and not self.document_ids:
            raise ValueError("至少选择一个文件夹或文档")

        return self


class KnowledgeDirectoryPublic(SQLModel):
    data: list[KnowledgeDirectoryEntryPublic]
    count: int


class KnowledgeDocumentPreviewPublic(SQLModel):
    filename: str
    content: str


class KnowledgeDocumentChunkPublic(SQLModel):
    chunk_index: int
    content: str
    section_path: list[str]
    page_numbers: list[int]
    image_urls: list[str]


class KnowledgeDocumentChunksPublic(SQLModel):
    data: list[KnowledgeDocumentChunkPublic]
    count: int


class KnowledgeSearchRequest(SQLModel):
    query: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=1000),
    ] = Field(description="用于知识库语义检索的问题")


class KnowledgeSearchResultPublic(SQLModel):
    document_id: uuid.UUID
    chunk_index: int
    knowledge_base_name: str
    filename: str
    content: str
    section_path: list[str]
    page_numbers: list[int]
    image_urls: list[str]
    score: float


class KnowledgeSearchResultsPublic(SQLModel):
    data: list[KnowledgeSearchResultPublic]
    count: int
