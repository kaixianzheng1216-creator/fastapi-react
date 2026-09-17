import uuid
from enum import StrEnum

from sqlalchemy import Enum
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class McpScope(StrEnum):
    INTERNAL = "internal"
    EXTERNAL = "external"


class McpApiKey(TimestampMixin, table=True):
    __tablename__ = "mcp_api_key"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    scope: McpScope = Field(
        sa_type=Enum(
            McpScope,
            name="mcp_scope",
            native_enum=False,
            create_constraint=True,
            values_callable=lambda scopes: [scope.value for scope in scopes],
        ),  # type: ignore
    )
    token_hash: str = Field(max_length=64, unique=True)
    key_prefix: str = Field(max_length=8)
    key_suffix: str = Field(max_length=4)
    is_active: bool = True
