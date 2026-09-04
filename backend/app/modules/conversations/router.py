import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.conversations import service
from app.modules.conversations.exceptions import (
    ConversationDeleteQueueError,
    ConversationNotFoundError,
    ConversationReportNotReadyError,
    ConversationTitleGenerationError,
)
from app.modules.conversations.schemas import (
    ConversationCreate,
    ConversationDetailPublic,
    ConversationPublic,
    ConversationRenameRequest,
    ConversationsPublic,
    ConversationTitleRequest,
)
from app.modules.files.exceptions import FileStorageUnavailableError

router = APIRouter(
    prefix="/agent/conversations",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
    ),
)


@router.post("", response_model=ConversationPublic, status_code=status.HTTP_201_CREATED)
def create_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    body: ConversationCreate,
) -> ConversationPublic:
    """创建会话。"""
    conversation = service.create_conversation(
        session=session,
        current_user=current_user,
        kind=body.kind,
    )

    return service.to_public(conversation)


@router.post(
    "/{conversation_id}/generate-title",
    response_model=ConversationPublic,
    responses=error_responses(
        ConversationNotFoundError,
        ConversationTitleGenerationError,
    ),
)
async def generate_conversation_title(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
    message: ConversationTitleRequest,
) -> ConversationPublic:
    """生成会话标题。"""
    conversation = await service.generate_conversation_title(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
        text=message.text,
        title_model=request.app.state.agent_resources.title_model,
    )

    return service.to_public(conversation)


@router.get("", response_model=ConversationsPublic)
def read_conversations(
    session: SessionDep,
    current_user: CurrentUser,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    archived: bool | None = None,
) -> ConversationsPublic:
    """读取会话列表。"""
    conversations, count = service.list_conversations(
        session=session,
        current_user=current_user,
        offset=offset,
        limit=limit,
        search=search,
        archived=archived,
    )

    return ConversationsPublic(
        data=[service.to_public(conversation) for conversation in conversations],
        count=count,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailPublic,
    responses=error_responses(ConversationNotFoundError),
)
async def read_conversation(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> ConversationDetailPublic:
    """读取会话详情。"""
    return await service.get_conversation_detail(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
        resources=request.app.state.agent_resources,
    )


@router.get(
    "/{conversation_id}/report.pdf",
    response_class=Response,
    responses={
        **error_responses(
            ConversationNotFoundError,
            ConversationReportNotReadyError,
            FileStorageUnavailableError,
        ),
        status.HTTP_200_OK: {
            "description": "PDF 报告",
            "content": {
                "application/pdf": {"schema": {"type": "string", "format": "binary"}}
            },
        },
    },
)
async def download_conversation_report_pdf(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> Response:
    """下载当前用户已经生成的调研报告 PDF。"""
    pdf = await service.get_conversation_report_pdf(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationPublic,
    responses=error_responses(ConversationNotFoundError),
)
def rename_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
    body: ConversationRenameRequest,
) -> ConversationPublic:
    """重命名会话。"""
    conversation = service.rename_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
        title=body.title,
    )

    return service.to_public(conversation)


@router.post(
    "/{conversation_id}/archive",
    response_model=ConversationPublic,
    responses=error_responses(ConversationNotFoundError),
)
def archive_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> ConversationPublic:
    """归档会话。"""
    conversation = service.archive_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    return service.to_public(conversation)


@router.post(
    "/{conversation_id}/unarchive",
    response_model=ConversationPublic,
    responses=error_responses(ConversationNotFoundError),
)
def unarchive_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> ConversationPublic:
    """取消归档会话。"""
    conversation = service.unarchive_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    return service.to_public(conversation)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_202_ACCEPTED,
    response_class=Response,
    responses=error_responses(ConversationDeleteQueueError),
)
async def delete_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> Response:
    """接受会话删除请求。"""
    await service.request_delete(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    return Response(status_code=status.HTTP_202_ACCEPTED)
