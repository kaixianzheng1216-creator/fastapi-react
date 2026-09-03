import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class ConversationKind(StrEnum):
    CHAT = "chat"
    RESEARCH = "research"


class Conversation(TimestampMixin, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id")
    title: str | None = Field(default=None, max_length=100)
    kind: ConversationKind = Field(
        default=ConversationKind.CHAT,
        sa_type=Enum(
            ConversationKind,
            name="conversation_kind",
            native_enum=False,
            length=16,
            values_callable=lambda kinds: [kind.value for kind in kinds],
        ),  # type: ignore
    )
    archived: bool = False
    deleting_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class ConversationFile(TimestampMixin, table=True):
    __tablename__ = "conversation_file"

    stored_file_id: uuid.UUID = Field(
        foreign_key="stored_file.id",
        primary_key=True,
    )
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id")
