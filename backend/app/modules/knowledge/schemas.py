import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints, field_validator
from sqlmodel import Field, SQLModel

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
