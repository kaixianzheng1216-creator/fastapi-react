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


class AttachmentTextTooLargeError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "单条消息的附件文本合计不能超过 256 KB"


class AgentRunQueueUnavailableError(ApplicationError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "Agent 任务队列暂不可用"


class AgentRunActiveError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "会话仍有正在运行的任务，请先取消任务"


class AgentRunNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Agent 运行不存在"


class AgentRunStreamExpiredError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "运行流已过期"


class AgentRunCancellationTimeoutError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "任务取消超时，请稍后重试"
