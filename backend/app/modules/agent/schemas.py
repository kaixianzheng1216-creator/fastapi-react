import base64
import binascii
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

MAX_MESSAGE_LENGTH = 20_000
MAX_RESOURCE_LENGTH = 14_000_000
MAX_THREAD_ID_LENGTH = 200
MAX_FILENAME_LENGTH = 255
MAX_MIME_TYPE_LENGTH = 255


def _validate_resource(value: str) -> str:
    if value.startswith("data:"):
        header, separator, payload = value.partition(",")
        if not separator or ";base64" not in header or not payload:
            raise ValueError("data URI must contain base64 encoded content")
        try:
            base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("data URI contains invalid base64 content") from error
        return value

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("resource must be an HTTP(S) URL or base64 data URI")

    return value


class TextMessagePart(BaseModel):
    type: Literal["text"]
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ImageMessagePart(BaseModel):
    type: Literal["image"]
    image: str = Field(min_length=1, max_length=MAX_RESOURCE_LENGTH)
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_image = field_validator("image")(_validate_resource)


class FileMessagePart(BaseModel):
    type: Literal["file"]
    data: str = Field(min_length=1, max_length=MAX_RESOURCE_LENGTH)
    mime_type: str = Field(
        alias="mimeType",
        min_length=1,
        max_length=MAX_MIME_TYPE_LENGTH,
    )
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_data = field_validator("data")(_validate_resource)


AssistantMessagePart = Annotated[
    TextMessagePart | ImageMessagePart | FileMessagePart,
    Field(discriminator="type"),
]


class AssistantMessage(BaseModel):
    role: Literal["user"]
    parts: list[AssistantMessagePart] = Field(min_length=1)


class AddMessageCommand(BaseModel):
    type: Literal["add-message"]
    message: AssistantMessage
    parent_id: str | None = Field(
        default=None,
        alias="parentId",
        min_length=1,
        max_length=MAX_THREAD_ID_LENGTH,
    )
    source_id: str | None = Field(
        default=None,
        alias="sourceId",
        min_length=1,
        max_length=MAX_THREAD_ID_LENGTH,
    )


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
