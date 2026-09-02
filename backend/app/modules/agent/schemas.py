import json
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_TEXT_PART_LENGTH = 20_000
MAX_MESSAGE_ATTACHMENT_COUNT = 20
MAX_FILE_REFERENCE_LENGTH = 41
MAX_IDENTIFIER_LENGTH = 200
MAX_MODEL_NAME_LENGTH = 200
MAX_FILENAME_LENGTH = 255
MAX_MIME_TYPE_LENGTH = 255
MAX_COMMAND_COUNT = 20
MAX_AGENT_REQUEST_BYTES = 2 * 1024 * 1024
FILE_REFERENCE_PREFIX = "file:"


def _validate_file_reference(resource_reference: str) -> str:
    if not resource_reference.startswith(FILE_REFERENCE_PREFIX):
        raise ValueError("附件引用无效")

    try:
        UUID(resource_reference.removeprefix(FILE_REFERENCE_PREFIX))
    except ValueError as error:
        raise ValueError("附件引用无效") from error

    return resource_reference


# 消息内容
class TextMessagePart(BaseModel):
    type: Literal["text"]
    text: str = Field(min_length=1, max_length=MAX_TEXT_PART_LENGTH)


class ImageMessagePart(BaseModel):
    type: Literal["image"]
    image: str = Field(min_length=1, max_length=MAX_FILE_REFERENCE_LENGTH)
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_image = field_validator("image")(_validate_file_reference)


class FileMessagePart(BaseModel):
    type: Literal["file"]
    data: str = Field(min_length=1, max_length=MAX_FILE_REFERENCE_LENGTH)
    mime_type: str = Field(
        alias="mimeType",
        min_length=1,
        max_length=MAX_MIME_TYPE_LENGTH,
    )
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_data = field_validator("data")(_validate_file_reference)


MessagePart = Annotated[
    TextMessagePart | ImageMessagePart | FileMessagePart,
    Field(discriminator="type"),
]


class Message(BaseModel):
    role: Literal["user"]
    parts: list[MessagePart] = Field(min_length=1)

    @field_validator("parts")
    @classmethod
    def validate_attachment_count(cls, parts: list[MessagePart]) -> list[MessagePart]:
        attachment_count = sum(
            isinstance(part, ImageMessagePart | FileMessagePart) for part in parts
        )

        if attachment_count > MAX_MESSAGE_ATTACHMENT_COUNT:
            raise ValueError(f"单条消息最多添加 {MAX_MESSAGE_ATTACHMENT_COUNT} 个附件")

        return parts


# 命令
class AddMessageCommand(BaseModel):
    type: Literal["add-message"]
    message: Message
    parent_id: str | None = Field(
        default=None,
        alias="parentId",
        min_length=1,
        max_length=MAX_IDENTIFIER_LENGTH,
    )
    source_id: None = Field(
        default=None,
        alias="sourceId",
    )


class AddToolResultCommand(BaseModel):
    type: Literal["add-tool-result"]
    tool_call_id: str = Field(alias="toolCallId", min_length=1)
    tool_name: str | None = Field(default=None, alias="toolName")
    result: Any
    is_error: bool | None = Field(default=None, alias="isError")
    artifact: Any | None = None
    model_content: Any | None = Field(default=None, alias="modelContent")


AgentCommand = Annotated[
    AddMessageCommand | AddToolResultCommand,
    Field(discriminator="type"),
]


# 请求外层结构
class AgentChatRequest(BaseModel):
    thread_id: UUID = Field(alias="threadId")
    model: str | None = Field(
        default=None,
        min_length=1,
        max_length=MAX_MODEL_NAME_LENGTH,
    )
    thinking_enabled: bool = Field(default=False, alias="thinkingEnabled")
    state: dict[str, Any]
    commands: list[AgentCommand] = Field(
        min_length=1,
        max_length=MAX_COMMAND_COUNT,
    )

    @model_validator(mode="after")
    def validate_request_size(self) -> AgentChatRequest:
        request_bytes = len(
            json.dumps(
                self.model_dump(mode="json", by_alias=True),
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode()
        )

        if request_bytes > MAX_AGENT_REQUEST_BYTES:
            raise ValueError(f"Agent 请求不能超过 {MAX_AGENT_REQUEST_BYTES} 字节")

        return self


class AgentRunResumeStateRequest(BaseModel):
    thread_id: UUID = Field(alias="threadId")


class AgentRunResumeStatePublic(BaseModel):
    run_id: UUID = Field(alias="runId")
    state: dict[str, Any]


class AgentModelPublic(BaseModel):
    id: str
    supports_thinking: bool = Field(alias="supportsThinking")


class AgentModelsPublic(BaseModel):
    data: list[AgentModelPublic]
    default_model: str = Field(alias="defaultModel")
