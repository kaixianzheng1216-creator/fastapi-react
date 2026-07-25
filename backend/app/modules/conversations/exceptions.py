from fastapi import status

from app.common.exceptions import ApplicationError


class ConversationNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "会话不存在"


class ConversationTitleGenerationError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "生成会话标题失败"
