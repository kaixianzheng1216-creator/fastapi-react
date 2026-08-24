import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints, field_validator
from sqlmodel import Field, SQLModel

from app.modules.knowledge.models import KnowledgeDocumentStatus

KnowledgeBaseName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class KnowledgeBaseCreate(SQLModel):
    name: KnowledgeBaseName
    description: str | None = Field(default=None, max_length=500)


class KnowledgeBaseUpdate(SQLModel):
    name: KnowledgeBaseName | None = None
    description: str | None = Field(default=None, max_length=500)
    is_enabled: bool | None = None

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


class KnowledgeDocumentUploadPublic(SQLModel):
    id: uuid.UUID
    upload_url: str = Field(serialization_alias="uploadUrl")
    upload_headers: dict[str, str] = Field(serialization_alias="uploadHeaders")


class KnowledgeDocumentPublic(SQLModel):
    id: uuid.UUID
    knowledge_base_id: uuid.UUID
    filename: str
    content_type: str
    size: int
    uploaded: bool
    status: KnowledgeDocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentsPublic(SQLModel):
    data: list[KnowledgeDocumentPublic]
    count: int


class KnowledgeDocumentPreviewPublic(SQLModel):
    filename: str
    content: str


class KnowledgeDocumentArtifactPublic(SQLModel):
    size: int
    download_url: str = Field(serialization_alias="downloadUrl")


class KnowledgeDocumentChunkPublic(SQLModel):
    chunk_index: int
    content: str
    section_path: list[str]
    page_numbers: list[int]


class KnowledgeDocumentChunksPublic(SQLModel):
    data: list[KnowledgeDocumentChunkPublic]
    count: int


class KnowledgeSearchRequest(SQLModel):
    query: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=1000),
    ]


class KnowledgeSearchResultPublic(SQLModel):
    document_id: uuid.UUID
    knowledge_base_name: str
    filename: str
    content: str
    section_path: list[str]
    page_numbers: list[int]
    score: float


class KnowledgeSearchResultsPublic(SQLModel):
    data: list[KnowledgeSearchResultPublic]
