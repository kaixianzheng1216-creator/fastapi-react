from app.common.exceptions import ApplicationError


class CredentialsValidationError(ApplicationError):
    status_code = 401
    detail = "登录已失效，请重新登录"


class InactiveUserError(ApplicationError):
    status_code = 403
    detail = "用户已停用，请联系管理员"


class InvalidSessionError(CredentialsValidationError):
    """浏览器当前会话已失效。"""


class InactiveSessionError(InactiveUserError):
    """浏览器当前会话所属的用户已停用。"""


class AuthUnavailableError(ApplicationError):
    status_code = 503
    detail = "登录服务暂不可用，请稍后重试"


class InvalidOriginError(ApplicationError):
    status_code = 403
    detail = "请求来源不受信任"
