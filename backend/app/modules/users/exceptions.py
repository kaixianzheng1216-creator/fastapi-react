from fastapi import status

from app.common.exceptions import ApplicationError


class UserAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "该用户名已存在"


class UserNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "用户不存在"


class IncorrectPasswordError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "密码错误"


class PasswordUnchangedError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "新密码不能与当前密码相同"


class SelfDeletionForbiddenError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "超级用户不能删除自己"


class InsufficientPrivilegesError(ApplicationError):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "当前用户权限不足"
