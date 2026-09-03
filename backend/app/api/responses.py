from http import HTTPStatus
from typing import Any

from app.common.exceptions import ApplicationError
from app.common.schemas import ErrorResponse


def error_responses(
    *error_types: type[ApplicationError],
) -> dict[int | str, dict[str, Any]]:
    return {
        error_type.status_code: {
            "model": ErrorResponse,
            "description": HTTPStatus(error_type.status_code).phrase,
        }
        for error_type in error_types
    }
