import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.modules.agent.schemas import Message, TextMessagePart


class ConversationPublic(BaseModel):
    id: uuid.UUID
    title: str
    archived: bool
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


class ConversationRenameRequest(BaseModel):
    title: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    ]


class ConversationsPublic(BaseModel):
    data: list[ConversationPublic]
    count: int


class TodoPublic(BaseModel):
    content: str
    status: Literal["pending", "in_progress", "completed"]


class ArtifactPublic(BaseModel):
    name: str
    url: str
    content_type: str = Field(alias="contentType")


class ConversationStatePublic(BaseModel):
    messages: list[dict[str, Any]]
    todos: list[TodoPublic]
    artifacts: list[ArtifactPublic]


class ConversationDetailPublic(ConversationPublic):
    state: ConversationStatePublic
