import logging
from typing import IO

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.modules.files.exceptions import (
    DocumentContentTooLargeError,
    DocumentParsingError,
    DocumentParsingUnavailableError,
)

DOCUMENT_PARSING_TIMEOUT_SECONDS = 5 * 60

MAX_EXTRACTED_TEXT_SIZE = 256 * 1024

DOCUMENT_PARSING_ERROR_LOG = "文档解析失败"

DOCUMENT_PARSING_UNAVAILABLE_LOG = "文档解析服务调用失败"

SUCCESS_STATUSES = {"success", "partial_success"}

logger = logging.getLogger(__name__)


class _ParsedDocument(BaseModel):
    md_content: str | None = None


class _ConversionResponse(BaseModel):
    status: str
    document: _ParsedDocument


async def extract_markdown(
    *,
    file: IO[bytes],
    filename: str,
    document_format: str,
) -> str:
    try:
        async with httpx.AsyncClient(
            timeout=DOCUMENT_PARSING_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(
                f"{str(settings.DOCLING_BASE_URL).rstrip('/')}/v1/convert/file",
                data={
                    "from_formats": document_format,
                    "to_formats": "md",
                    "image_export_mode": "placeholder",
                },
                files={"files": (filename, file)},
            )
    except httpx.HTTPError as error:
        logger.exception(DOCUMENT_PARSING_UNAVAILABLE_LOG)

        raise DocumentParsingUnavailableError from error

    if response.status_code >= 500:
        logger.error(
            DOCUMENT_PARSING_UNAVAILABLE_LOG,
            extra={"status_code": response.status_code},
        )

        raise DocumentParsingUnavailableError
    if response.status_code >= 400:
        logger.warning(
            DOCUMENT_PARSING_ERROR_LOG,
            extra={"status_code": response.status_code},
        )

        raise DocumentParsingError

    try:
        conversion = _ConversionResponse.model_validate(response.json())
    except (ValueError, ValidationError) as error:
        logger.exception(DOCUMENT_PARSING_UNAVAILABLE_LOG)

        raise DocumentParsingUnavailableError from error

    markdown = conversion.document.md_content

    if (
        conversion.status not in SUCCESS_STATUSES
        or not markdown
        or not markdown.strip()
    ):
        logger.warning(
            DOCUMENT_PARSING_ERROR_LOG,
            extra={"conversion_status": conversion.status},
        )

        raise DocumentParsingError

    if len(markdown.encode("utf-8")) > MAX_EXTRACTED_TEXT_SIZE:
        raise DocumentContentTooLargeError

    return markdown
