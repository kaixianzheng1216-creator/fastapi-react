from fastapi import status

from app.common.exceptions import ApplicationError


class ModelsUnavailableError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "模型列表暂时不可用"


class ModelNotAvailableError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "所选模型不可用"


class ModelServiceUnavailableError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "模型服务暂时不可用"


class ThinkingNotSupportedError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "当前模型不支持思考模式"


class ImageInputNotSupportedError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "当前模型不支持图片，请切换支持图片识别的模型"

