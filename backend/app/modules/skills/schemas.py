from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue


class SkillMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = Field(
        min_length=1,
        max_length=64,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    description: str = Field(min_length=1, max_length=1024)


class SkillMdRequest(SkillMetadata):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1)


class SkillSummaryPublic(BaseModel):
    name: str
    description: str


class SkillsPublic(BaseModel):
    data: list[SkillSummaryPublic]
    count: int


class SkillFileNodePublic(BaseModel):
    name: str
    path: str
    type: Literal["file", "folder"]
    children: list[SkillFileNodePublic] | None = None


class SkillPublic(BaseModel):
    frontmatter: dict[str, JsonValue]
    content: str
    file_count: int = Field(serialization_alias="fileCount")
    files: list[SkillFileNodePublic]
