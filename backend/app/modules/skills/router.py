import mimetypes
from typing import Annotated

from fastapi import APIRouter, File, Query, UploadFile, status
from fastapi.responses import Response

from app.api.dependencies import StoreDep
from app.modules.auth.dependencies import CurrentUser
from app.modules.skills import service
from app.modules.skills.schemas import (
    SkillMdRequest,
    SkillPublic,
    SkillsPublic,
)

router = APIRouter(prefix="/skills", tags=["skills"])


@router.post(
    "/md",
    response_model=SkillPublic,
    status_code=status.HTTP_201_CREATED,
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


@router.get("", response_model=SkillsPublic)
async def read_skills(
    store: StoreDep,
    current_user: CurrentUser,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
) -> SkillsPublic:
    """读取当前用户的 Skill 列表。"""
    skills, count = await service.list_skills(
        store=store,
        user_id=current_user.id,
        offset=offset,
        limit=limit,
        search=search,
    )

    return SkillsPublic(data=skills, count=count)


@router.get(
    "/{skill_name}",
    response_model=SkillPublic,
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


@router.get("/{skill_name}/files/{file_path:path}")
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
    media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    return Response(content=content, media_type=media_type)


@router.delete("/{skill_name}", status_code=status.HTTP_204_NO_CONTENT)
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
