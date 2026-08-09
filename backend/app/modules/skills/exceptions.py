from fastapi import status

from app.common.exceptions import ApplicationError


class SkillInvalidError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Skill 格式无效"


class SkillZipTooLargeError(ApplicationError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    detail = "Skill 压缩包超过大小限制"


class SkillMdTooLargeError(ApplicationError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    detail = "SKILL.md 超过大小限制"


class SkillAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "同名 Skill 已存在"


class SkillNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Skill 不存在"
