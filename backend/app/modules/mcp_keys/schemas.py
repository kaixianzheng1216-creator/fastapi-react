import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.modules.mcp_keys.models import McpScope

KeyName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class McpApiKeyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: KeyName
    scope: McpScope


class McpApiKeyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: KeyName
    is_active: bool


class McpApiKeyPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    scope: McpScope
    key_prefix: str
    key_suffix: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class McpApiKeyCreated(McpApiKeyPublic):
    key: str


class McpApiKeysPublic(BaseModel):
    data: list[McpApiKeyPublic]
