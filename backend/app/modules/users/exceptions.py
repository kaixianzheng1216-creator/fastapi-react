from fastapi import status

from app.common.exceptions import ApplicationError, ErrorResponse


class UserAlreadyExistsError(ApplicationError):
    pass


class UserNotFoundError(ApplicationError):
    pass


class IncorrectPasswordError(ApplicationError):
    pass


class PasswordUnchangedError(ApplicationError):
    pass


class SelfDeletionForbiddenError(ApplicationError):
    pass


class InsufficientPrivilegesError(ApplicationError):
    pass


ERROR_RESPONSES: dict[type[ApplicationError], ErrorResponse] = {
    UserAlreadyExistsError: ErrorResponse(status.HTTP_409_CONFLICT, "该用户名已存在"),
    UserNotFoundError: ErrorResponse(status.HTTP_404_NOT_FOUND, "用户不存在"),
    IncorrectPasswordError: ErrorResponse(status.HTTP_400_BAD_REQUEST, "密码错误"),
    PasswordUnchangedError: ErrorResponse(
        status.HTTP_400_BAD_REQUEST,
        "新密码不能与当前密码相同",
    ),
    SelfDeletionForbiddenError: ErrorResponse(
        status.HTTP_403_FORBIDDEN,
        "超级用户不能删除自己",
    ),
    InsufficientPrivilegesError: ErrorResponse(
        status.HTTP_403_FORBIDDEN,
        "当前用户权限不足",
    ),
}
