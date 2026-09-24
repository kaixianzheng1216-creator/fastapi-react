import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.common.schemas import ErrorResponse
from app.mcp.catalog import project_tool_catalog
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.mcp_keys import service
from app.modules.mcp_keys.models import McpPermission
from app.modules.mcp_keys.schemas import (
    McpApiKeyCreate,
    McpApiKeyCreated,
    McpApiKeyPublic,
    McpApiKeysPublic,
    McpApiKeyUpdate,
    McpToolPublic,
)
from app.modules.projects.dependencies import require_project
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/mcp/keys",
    tags=["mcp_keys"],
    responses={
        **error_responses(
            CredentialsValidationError, InactiveUserError, InsufficientPrivilegesError
        ),
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse},
    },
)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_mcp_api_key(
    session: SessionDep,
    current_user: CurrentUser,
    body: McpApiKeyCreate,
    response: Response,
) -> McpApiKeyCreated:
    """创建密钥，完整密钥仅在此响应中返回。"""
    api_key, key = service.create_api_key(session=session, body=body, user=current_user)

    response.headers["Cache-Control"] = "no-store"

    return McpApiKeyCreated(
        **McpApiKeyPublic.model_validate(api_key).model_dump(), key=key
    )


@router.get("")
def read_mcp_api_keys(
    session: SessionDep,
    current_user: CurrentUser,
    response: Response,
    project_id: uuid.UUID,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=100)] = None,
    permission: McpPermission | None = None,
    is_active: bool | None = None,
) -> McpApiKeysPublic:
    require_project(session, current_user, project_id)

    response.headers["Cache-Control"] = "no-store"

    rows, count = service.list_api_keys(
        session, project_id, skip, limit, search, permission, is_active
    )

    return McpApiKeysPublic(
        data=[McpApiKeyPublic.model_validate(key) for key in rows], count=count
    )


@router.put("/{key_id}")
def update_mcp_api_key(
    key_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: McpApiKeyUpdate,
) -> McpApiKeyPublic:
    """修改名称、启用状态及权限，所属项目不可变更。"""
    return McpApiKeyPublic.model_validate(
        service.update_api_key(
            session=session,
            key_id=key_id,
            body=body,
            user=current_user,
        )
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_api_key(
    key_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> None:
    """删除密钥，后续请求立即失效。"""
    service.delete_api_key(session=session, key_id=key_id, user=current_user)


@router.get("/tools")
def read_project_mcp_tools(_current_user: CurrentUser) -> list[McpToolPublic]:
    return project_tool_catalog()
