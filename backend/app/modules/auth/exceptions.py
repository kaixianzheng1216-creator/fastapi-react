from fastapi import status

from app.common.exceptions import ApplicationError, ErrorResponse


class InvalidCredentialsError(ApplicationError):
    pass


class CredentialsValidationError(ApplicationError):
    pass


class InactiveUserError(ApplicationError):
    pass


ERROR_RESPONSES: dict[type[ApplicationError], ErrorResponse] = {
    InvalidCredentialsError: ErrorResponse(
        status.HTTP_400_BAD_REQUEST, "用户名或密码错误"
    ),
    CredentialsValidationError: ErrorResponse(
        status.HTTP_401_UNAUTHORIZED,
        "无法验证身份凭证",
        {"WWW-Authenticate": "Bearer"},
    ),
    InactiveUserError: ErrorResponse(status.HTTP_400_BAD_REQUEST, "用户已停用"),
}
