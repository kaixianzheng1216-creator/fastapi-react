import uuid

from fastapi import APIRouter, Depends, Response, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.common.schemas import ErrorResponse
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.mcp_keys import service
from app.modules.mcp_keys.models import McpScope
from app.modules.mcp_keys.schemas import (
    McpApiKeyCreate,
    McpApiKeyCreated,
    McpApiKeyPublic,
    McpApiKeysPublic,
    McpApiKeyUpdate,
)
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/mcp/keys",
    tags=["mcp_keys"],
    dependencies=[Depends(get_current_active_superuser)],
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
    body: McpApiKeyCreate,
    response: Response,
) -> McpApiKeyCreated:
    """创建密钥，完整密钥仅在此响应中返回。"""
    api_key, key = service.create_api_key(session=session, body=body)

    response.headers["Cache-Control"] = "no-store"

    return McpApiKeyCreated(
        **McpApiKeyPublic.model_validate(api_key).model_dump(), key=key
    )


@router.get("")
def read_mcp_api_keys(
    session: SessionDep, scope: McpScope, response: Response
) -> McpApiKeysPublic:
    """按内部或外部用途查询密钥，不返回密钥摘要或明文。"""
    response.headers["Cache-Control"] = "no-store"

    return McpApiKeysPublic(
        data=[
            McpApiKeyPublic.model_validate(api_key)
            for api_key in service.list_api_keys(session=session, scope=scope)
        ]
    )


@router.put("/{key_id}")
def update_mcp_api_key(
    key_id: uuid.UUID,
    session: SessionDep,
    body: McpApiKeyUpdate,
) -> McpApiKeyPublic:
    """修改密钥名称和启用状态，用途不可变更。"""
    return McpApiKeyPublic.model_validate(
        service.update_api_key(
            session=session,
            key_id=key_id,
            body=body,
        )
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mcp_api_key(key_id: uuid.UUID, session: SessionDep) -> None:
    """删除密钥，后续请求立即失效。"""
    service.delete_api_key(session=session, key_id=key_id)
