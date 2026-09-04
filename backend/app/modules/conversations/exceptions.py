from fastapi import status

from app.common.exceptions import ApplicationError


class ConversationNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "会话不存在"


class ConversationTitleGenerationError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "生成会话标题失败"


class ConversationRunActiveError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "会话仍有正在运行的任务，请先取消任务"


class ConversationDeleteQueueError(ApplicationError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "删除任务队列暂不可用"


class ConversationReportNotReadyError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "调研报告尚未生成"


class ConversationReportPdfGenerationError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "生成 PDF 失败"
