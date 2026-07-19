from fastapi import status

from app.common.exceptions import ApplicationError


class AgentNotConfiguredError(ApplicationError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "Agent 服务未配置"
