import json

import magic  # type: ignore[import-untyped]

from app.modules.files.exceptions import (
    FileContentTypeMismatchError,
    TextFileEncodingError,
)


def validate_text_content(content: bytes, content_type: str) -> str:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise TextFileEncodingError from None

    if "\x00" in text:
        raise FileContentTypeMismatchError

    if content_type == "application/json":
        try:
            json.loads(text)
        except json.JSONDecodeError:
            raise FileContentTypeMismatchError from None

    return text


def validate_content_type_header(header: bytes, expected_content_type: str) -> None:
    detected_content_type = str(magic.from_buffer(header, mime=True))

    if detected_content_type != expected_content_type:
        raise FileContentTypeMismatchError
