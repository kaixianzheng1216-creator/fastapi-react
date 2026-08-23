import uuid

from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class Conversation(TimestampMixin, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id")
    title: str | None = Field(default=None, max_length=100)
    archived: bool = False


class ConversationFile(TimestampMixin, table=True):
    __tablename__ = "conversation_file"

    stored_file_id: uuid.UUID = Field(
        foreign_key="stored_file.id",
        primary_key=True,
    )
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id")
