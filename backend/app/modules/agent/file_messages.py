from typing import Any
from uuid import UUID

from langchain_core.messages import BaseMessage
from sqlmodel import Session

from app.modules.conversations.message_files import refresh_message_file_urls
from app.modules.files import service as file_service
from app.modules.files.exceptions import FileContentTypeMismatchError


def prepare_message_file_inputs(
    message: BaseMessage,
    user_id: UUID,
    session: Session,
    supports_vision: bool,
) -> BaseMessage:
    if not isinstance(message.content, list):
        return message

    prepared_content: list[str | dict[str, Any]] = []

    for part in message.content:
        if not isinstance(part, dict):
            prepared_content.append(part)
            continue

        part_type = part.get("type")

        if part_type == "image_url" and not supports_vision:
            continue

        if part_type == "file":
            metadata = part.get("metadata")

            if not isinstance(metadata, dict):
                raise FileContentTypeMismatchError

            file_id = metadata.get("file_id")

            if not isinstance(file_id, str):
                raise FileContentTypeMismatchError

            stored_file = file_service.resolve_file_reference(
                session=session,
                user_id=user_id,
                reference=f"{file_service.FILE_REFERENCE_PREFIX}{file_id}",
            )

            text_content = file_service.get_extracted_text(stored_file)
            prepared_content.append(
                {
                    "type": "text",
                    "text": (
                        f"以下是用户上传附件的提取内容。\n"
                        f"文件名：{stored_file.filename}\n\n{text_content}"
                    ),
                }
            )
            continue

        prepared_content.append(part)

    prepared_message = message.model_copy(update={"content": prepared_content})

    return refresh_message_file_urls(prepared_message, user_id)
