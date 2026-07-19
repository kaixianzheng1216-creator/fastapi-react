from uuid import UUID

from sqlmodel import Field, SQLModel

MAX_MESSAGE_LENGTH = 20_000


class AgentChatRequest(SQLModel):
    conversation_id: UUID
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
