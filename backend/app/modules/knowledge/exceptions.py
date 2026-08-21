from fastapi import status

from app.common.exceptions import ApplicationError


class KnowledgeBaseAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "知识库名称已存在"


class KnowledgeBaseNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "知识库不存在"
