import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.modules.mcp_keys.models import McpPermission

KeyName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class McpApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: KeyName
    project_id: uuid.UUID
    permission: McpPermission


class McpApiKeyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: KeyName
    is_active: bool
    permission: McpPermission


class McpApiKeyPublic(BaseModel):
    project_id: uuid.UUID
    created_by: uuid.UUID
    permission: McpPermission
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    key_prefix: str
    key_suffix: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class McpApiKeyCreated(McpApiKeyPublic):
    key: str


class McpApiKeysPublic(BaseModel):
    data: list[McpApiKeyPublic]
    count: int = 0


class McpToolPublic(BaseModel):
    name: str
    description: str
    group: Literal["knowledge", "business"]
    read_only: bool
