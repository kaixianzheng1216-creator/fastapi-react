from fastapi import status

from app.common.exceptions import ApplicationError


class KnowledgeBaseAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "知识库名称已存在"


class KnowledgeBaseNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "知识库不存在"


class KnowledgeDocumentNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "知识库文档不存在"


class KnowledgeDocumentStateError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "当前文档状态不允许此操作"


class KnowledgeDocumentArtifactUnavailableError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "文档处理产物不可用"


class KnowledgeSearchUnavailableError(ApplicationError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "知识库检索暂时不可用"
