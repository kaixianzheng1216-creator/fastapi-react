import uuid
from datetime import datetime
from typing import Any, Literal, Self

from pydantic import BaseModel, Field, model_validator

from app.modules.agent.schemas import Message, TextMessagePart


class ConversationPublic(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class ConversationTitleRequest(Message):
    @model_validator(mode="after")
    def require_text(self) -> Self:
        if not self.text:
            raise ValueError("生成标题需要文本消息")

        return self

    @property
    def text(self) -> str:
        return "\n".join(
            part.text.strip()
            for part in self.parts
            if isinstance(part, TextMessagePart) and part.text.strip()
        )


class ConversationsPublic(BaseModel):
    data: list[ConversationPublic]
    count: int


class TodoPublic(BaseModel):
    content: str
    status: Literal["pending", "in_progress", "completed"]


class ConversationStatePublic(BaseModel):
    messages: list[dict[str, Any]]
    todos: list[TodoPublic]


class ConversationDetailPublic(ConversationPublic):
    state: ConversationStatePublic
