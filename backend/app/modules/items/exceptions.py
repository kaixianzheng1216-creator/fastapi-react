from fastapi import status

from app.common.exceptions import ApplicationError


class ItemNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "条目不存在"


class ItemPermissionError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "权限不足"
