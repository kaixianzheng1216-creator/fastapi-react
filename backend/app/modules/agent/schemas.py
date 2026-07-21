import base64
import binascii
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

MAX_TEXT_PART_LENGTH = 20_000
MAX_RESOURCE_REFERENCE_LENGTH = 14_000_000
MAX_IDENTIFIER_LENGTH = 200
MAX_FILENAME_LENGTH = 255
MAX_MIME_TYPE_LENGTH = 255
ALLOWED_RESOURCE_SCHEMES = {"http", "https"}


def _validate_resource_reference(resource_reference: str) -> str:
    if resource_reference.startswith("data:"):
        metadata, comma, encoded_content = resource_reference.partition(",")

        if not comma or ";base64" not in metadata or not encoded_content:
            raise ValueError("Data URI 必须包含 Base64 编码内容")

        try:
            base64.b64decode(encoded_content, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError("Data URI 包含无效的 Base64 内容") from error

        return resource_reference

    parsed_url = urlparse(resource_reference)

    if parsed_url.scheme not in ALLOWED_RESOURCE_SCHEMES or not parsed_url.netloc:
        raise ValueError("资源必须是 HTTP(S) URL 或 Base64 Data URI")

    return resource_reference


# 消息内容
class TextMessagePart(BaseModel):
    type: Literal["text"]
    text: str = Field(min_length=1, max_length=MAX_TEXT_PART_LENGTH)


class ImageMessagePart(BaseModel):
    type: Literal["image"]
    image: str = Field(min_length=1, max_length=MAX_RESOURCE_REFERENCE_LENGTH)
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_image = field_validator("image")(_validate_resource_reference)


class FileMessagePart(BaseModel):
    type: Literal["file"]
    data: str = Field(min_length=1, max_length=MAX_RESOURCE_REFERENCE_LENGTH)
    mime_type: str = Field(
        alias="mimeType",
        min_length=1,
        max_length=MAX_MIME_TYPE_LENGTH,
    )
    filename: str | None = Field(default=None, max_length=MAX_FILENAME_LENGTH)

    _validate_data = field_validator("data")(_validate_resource_reference)


MessagePart = Annotated[
    TextMessagePart | ImageMessagePart | FileMessagePart,
    Field(discriminator="type"),
]


class Message(BaseModel):
    role: Literal["user"]
    parts: list[MessagePart] = Field(min_length=1)


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
    source_id: str | None = Field(
        default=None,
        alias="sourceId",
        min_length=1,
        max_length=MAX_IDENTIFIER_LENGTH,
    )


class AddToolResultCommand(BaseModel):
    type: Literal["add-tool-result"]
    tool_call_id: str = Field(alias="toolCallId", min_length=1)
    result: Any


AgentCommand = Annotated[
    AddMessageCommand | AddToolResultCommand,
    Field(discriminator="type"),
]


# 请求外层结构
class AgentChatRequest(BaseModel):
    thread_id: str = Field(
        alias="threadId",
        min_length=1,
        max_length=MAX_IDENTIFIER_LENGTH,
    )
    state: dict[str, Any] | None = None
    commands: list[AgentCommand] = Field(min_length=1)
