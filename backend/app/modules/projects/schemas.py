import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.modules.projects.models import ProjectRole

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    description: str | None = Field(default=None, max_length=500)
    admin_ids: set[uuid.UUID] = Field(default_factory=set, max_length=100)


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("项目名称不能为空")
        return value


class ProjectPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    role: ProjectRole | None = None
    member_count: int = 0
    knowledge_base_count: int = 0


class ProjectsPublic(BaseModel):
    data: list[ProjectPublic]
    count: int


class MembersAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_ids: set[uuid.UUID] = Field(min_length=1, max_length=100)


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: ProjectRole


class MemberPublic(BaseModel):
    user_id: uuid.UUID
    username: str
    full_name: str | None
    role: ProjectRole
    created_at: datetime


class MembersPublic(BaseModel):
    data: list[MemberPublic]
    count: int


class CandidatePublic(BaseModel):
    user_id: uuid.UUID
    username: str
    full_name: str | None
    is_member: bool


class CandidatesPublic(BaseModel):
    data: list[CandidatePublic]
    count: int
