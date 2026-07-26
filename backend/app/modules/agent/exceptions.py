from fastapi import status

from app.common.exceptions import ApplicationError


class ModelsUnavailableError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "模型列表暂时不可用"
