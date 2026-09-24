from app.common.exceptions import ApplicationError


class ProjectNotFoundError(ApplicationError):
    status_code = 404
    detail = "项目不存在或无权访问"


class ProjectConflictError(ApplicationError):
    status_code = 409
    detail = "项目名称或成员关系已存在"


class ProjectNotEmptyError(ApplicationError):
    status_code = 409
    detail = "项目仍有知识库，请先清空"


class ProjectMemberNotFoundError(ApplicationError):
    status_code = 404
    detail = "项目成员不存在"
