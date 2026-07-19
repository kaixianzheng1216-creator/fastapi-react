from fastapi import status

from app.common.exceptions import ApplicationError, ErrorResponse


class ItemNotFoundError(ApplicationError):
    pass


class ItemPermissionError(ApplicationError):
    pass


ERROR_RESPONSES: dict[type[ApplicationError], ErrorResponse] = {
    ItemNotFoundError: ErrorResponse(status.HTTP_404_NOT_FOUND, "条目不存在"),
    ItemPermissionError: ErrorResponse(status.HTTP_403_FORBIDDEN, "权限不足"),
}
