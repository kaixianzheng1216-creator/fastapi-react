from fastapi import status

from app.common.exceptions import ApplicationError


class UserNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "用户不存在"


class SelfDeletionForbiddenError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "超级用户不能删除自己"


class SelfAdminStatusChangeForbiddenError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "管理员不能停用自己或取消自己的管理员身份"


class InsufficientPrivilegesError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "当前用户权限不足"
