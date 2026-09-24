import uuid
from enum import StrEnum

from sqlalchemy import Enum
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class McpPermission(StrEnum):
    READ_ONLY = "read_only"
    READ_WRITE = "read_write"


class McpApiKey(TimestampMixin, table=True):
    __tablename__ = "mcp_api_key"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100)
    project_id: uuid.UUID = Field(foreign_key="project.id", ondelete="CASCADE")
    created_by: uuid.UUID = Field(foreign_key="user.id")
    permission: McpPermission = Field(  # type: ignore[call-overload]
        sa_type=Enum(
            McpPermission,
            values_callable=lambda e: [v.value for v in e],
            native_enum=False,
            create_constraint=True,
            name="mcp_permission",
        ),
    )
    is_active: bool = True

    token_hash: str = Field(max_length=64, unique=True)
    key_prefix: str = Field(max_length=8)
    key_suffix: str = Field(max_length=4)
