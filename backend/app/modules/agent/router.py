from collections.abc import AsyncIterable
from typing import cast
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import SessionDep
from app.modules.agent import run_service, service
from app.modules.agent.config import settings
from app.modules.agent.run_stream import AgentRunStream
from app.modules.agent.schemas import (
    AgentChatRequest,
    AgentModelPublic,
    AgentModelsPublic,
    AgentRunResumeStatePublic,
    AgentRunResumeStateRequest,
)
from app.modules.auth.dependencies import CurrentUser, get_current_user

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
)

RESUMABLE_STREAM_ID_HEADER = "x-resumable-stream-id"


def _run_stream(request: Request) -> AgentRunStream:
    return cast(AgentRunStream, request.app.state.agent_run_stream)


def _stream_response(run_id: UUID, content: AsyncIterable[bytes]) -> StreamingResponse:
    response = StreamingResponse(content, media_type="text/event-stream")
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    response.headers[RESUMABLE_STREAM_ID_HEADER] = str(run_id)

    return response


@router.get("/models", response_model=AgentModelsPublic)
async def read_models() -> AgentModelsPublic:
    """读取可用模型。"""
    models = await service.list_models()

    return AgentModelsPublic(
        data=[
            AgentModelPublic(
                id=model.model_name,
                supportsThinking=model.supports_thinking,
            )
            for model in models
        ],
        defaultModel=settings.DEFAULT_MODEL_NAME,
    )


@router.post("/runs")
async def create_agent_run(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    chat_request: AgentChatRequest,
) -> StreamingResponse:
    """创建 Agent 运行，并返回可恢复的 SSE 输出流。"""
    run_id = await run_service.create_run(
        session=session,
        current_user=current_user,
        request=chat_request,
    )

    run_stream = _run_stream(request)

    return _stream_response(
        run_id,
        run_service.stream_run(run_id, run_stream),
    )


@router.post(
    "/runs/resume-state",
    response_model=AgentRunResumeStatePublic,
    responses={status.HTTP_204_NO_CONTENT: {"description": "没有活动运行"}},
)
async def read_agent_run_resume_state(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    body: AgentRunResumeStateRequest,
) -> AgentRunResumeStatePublic | Response:
    """返回会话的活跃运行状态；没有活跃运行时返回 204。"""
    resume_state = await run_service.read_resume_state(
        session=session,
        user_id=current_user.id,
        conversation_id=body.thread_id,
        stream=_run_stream(request),
    )

    if resume_state is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return resume_state


@router.get("/runs/{run_id}/stream")
async def resume_agent_run(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    run_id: UUID,
) -> StreamingResponse:
    """恢复指定运行的 SSE 输出流。"""
    run_stream = _run_stream(request)

    owned_run_id = await run_service.prepare_resume(
        session=session,
        user_id=current_user.id,
        run_id=run_id,
        stream=run_stream,
    )

    return _stream_response(
        owned_run_id,
        run_service.stream_run(owned_run_id, run_stream),
    )


@router.post("/runs/{run_id}/cancel", status_code=status.HTTP_202_ACCEPTED)
async def cancel_agent_run(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    run_id: UUID,
) -> None:
    """请求取消指定运行。"""
    await run_service.cancel_run(
        session=session,
        user_id=current_user.id,
        run_id=run_id,
        stream=_run_stream(request),
    )
