from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import Response

from app.api.dependencies import StoreDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.skills import service
from app.modules.skills.exceptions import (
    SkillAlreadyExistsError,
    SkillInvalidError,
    SkillMdTooLargeError,
    SkillNotFoundError,
    SkillZipTooLargeError,
)
from app.modules.skills.schemas import (
    SkillMdRequest,
    SkillPublic,
    SkillSummaryPublic,
)

router = APIRouter(
    prefix="/skills",
    tags=["skills"],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
    ),
)


@router.post(
    "/md",
    response_model=SkillPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        SkillAlreadyExistsError,
        SkillMdTooLargeError,
    ),
)
async def create_md_skill(
    store: StoreDep,
    current_user: CurrentUser,
    request: SkillMdRequest,
) -> SkillPublic:
    """使用 SKILL.md 创建 Skill。"""
    return await service.create_md_skill(
        store=store,
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/zip",
    response_model=SkillPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        SkillInvalidError,
        SkillAlreadyExistsError,
        SkillZipTooLargeError,
        SkillMdTooLargeError,
    ),
)
async def create_zip_skill(
    store: StoreDep,
    current_user: CurrentUser,
    skill_zip: UploadFile = File(),
) -> SkillPublic:
    """使用 ZIP 压缩包创建 Skill。"""
    zip_content = await skill_zip.read(service.MAX_ZIP_SIZE + 1)

    return await service.create_zip_skill(
        store=store,
        user_id=current_user.id,
        zip_content=zip_content,
    )


@router.get(
    "",
    response_model=list[SkillSummaryPublic],
    responses=error_responses(
        SkillInvalidError,
        SkillNotFoundError,
        SkillMdTooLargeError,
    ),
)
async def read_skills(
    store: StoreDep,
    current_user: CurrentUser,
) -> list[SkillSummaryPublic]:
    """读取当前用户的 Skill 列表。"""
    return await service.list_skills(store=store, user_id=current_user.id)


@router.get(
    "/{skill_name}",
    response_model=SkillPublic,
    responses=error_responses(
        SkillInvalidError,
        SkillNotFoundError,
        SkillMdTooLargeError,
    ),
)
async def read_skill(
    store: StoreDep,
    current_user: CurrentUser,
    skill_name: str,
) -> SkillPublic:
    """读取当前用户的 Skill 详情。"""
    return await service.get_skill(
        store=store,
        user_id=current_user.id,
        skill_name=skill_name,
    )


@router.get(
    "/{skill_name}/files/{file_path:path}",
    response_class=Response,
    responses={
        status.HTTP_200_OK: {
            "content": {
                "application/octet-stream": {
                    "schema": {
                        "type": "string",
                        "format": "binary",
                    }
                }
            },
            "description": "Skill 文件内容",
        },
        **error_responses(SkillNotFoundError),
    },
)
async def read_skill_file(
    store: StoreDep,
    current_user: CurrentUser,
    skill_name: str,
    file_path: str,
) -> Response:
    """读取当前用户 Skill 中的具体文件。"""
    content = await service.get_skill_file(
        store=store,
        user_id=current_user.id,
        skill_name=skill_name,
        file_path=file_path,
    )
    return Response(content=content, media_type="application/octet-stream")


@router.delete(
    "/{skill_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(SkillNotFoundError),
)
async def delete_skill(
    store: StoreDep,
    current_user: CurrentUser,
    skill_name: str,
) -> None:
    """删除当前用户的整个 Skill。"""
    await service.delete_skill(
        store=store,
        user_id=current_user.id,
        skill_name=skill_name,
    )
