from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

MAX_MESSAGE_LENGTH = 20_000
MAX_THREAD_ID_LENGTH = 200


class AssistantMessagePart(BaseModel):
    type: Literal["text"]
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class AssistantMessage(BaseModel):
    role: Literal["user"]
    parts: list[AssistantMessagePart] = Field(min_length=1)


class AddMessageCommand(BaseModel):
    type: Literal["add-message"]
    message: AssistantMessage


class AddToolResultCommand(BaseModel):
    type: Literal["add-tool-result"]
    tool_call_id: str = Field(alias="toolCallId", min_length=1)
    result: Any


AgentCommand = Annotated[
    AddMessageCommand | AddToolResultCommand,
    Field(discriminator="type"),
]


class AgentChatRequest(BaseModel):
    thread_id: str = Field(
        alias="threadId",
        min_length=1,
        max_length=MAX_THREAD_ID_LENGTH,
    )
    state: dict[str, Any] | None = None
    commands: list[AgentCommand] = Field(min_length=1)
