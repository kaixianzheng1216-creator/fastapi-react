from fastapi import status

from app.common.exceptions import ApplicationError


class InvalidCredentialsError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "用户名或密码错误"


class CredentialsValidationError(ApplicationError):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "无法验证身份凭证"
    headers = {"WWW-Authenticate": "Bearer"}


class InactiveUserError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "用户已停用"
