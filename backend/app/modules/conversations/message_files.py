from typing import Any
from uuid import UUID

from langchain_core.messages import BaseMessage

from app.modules.files import object_storage


def refresh_message_file_urls(message: BaseMessage, user_id: UUID) -> BaseMessage:
    if not isinstance(message.content, list):
        return message

    refreshed_content: list[str | dict[str, Any]] = []
    has_file_attachment = False

    for part in message.content:
        if not isinstance(part, dict):
            refreshed_content.append(part)
            continue

        metadata = part.get("metadata")
        if not isinstance(metadata, dict):
            refreshed_content.append(part)
            continue

        object_key = metadata.get("object_key")

        if not isinstance(object_key, str):
            refreshed_content.append(part)
            continue

        if not object_storage.is_owner_object_key(
            object_key=object_key, owner_id=user_id
        ):
            raise ValueError("文件对象不属于当前用户")

        refreshed_part = dict(part)
        download_url = object_storage.create_download_url(object_key)

        if refreshed_part.get("type") == "image_url":
            refreshed_part["image_url"] = {"url": download_url}
        elif refreshed_part.get("type") == "file":
            refreshed_part["url"] = download_url

        refreshed_content.append(refreshed_part)
        has_file_attachment = True

    if not has_file_attachment:
        return message

    return message.model_copy(update={"content": refreshed_content})
