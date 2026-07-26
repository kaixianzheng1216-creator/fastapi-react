from assistant_stream.serialization import (  # type: ignore[import-untyped]
    AssistantTransportResponse,
)
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import SessionDep
from app.modules.agent import service
from app.modules.agent.config import settings
from app.modules.agent.schemas import (
    AgentChatRequest,
    AgentModelPublic,
    AgentModelsPublic,
)
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.conversations import service as conversation_service

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/models", response_model=AgentModelsPublic)
async def read_models() -> AgentModelsPublic:
    """读取可用模型。"""
    model_ids = await service.list_models()

    return AgentModelsPublic(
        data=[AgentModelPublic(id=model_id) for model_id in model_ids],
        defaultModel=settings.DEFAULT_MODEL_NAME,
    )


@router.post("/chat")
async def chat(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    chat_request: AgentChatRequest,
) -> StreamingResponse:
    conversation_service.touch_conversation(
        session=session,
        current_user=current_user,
        conversation_id=chat_request.thread_id,
    )

    chat_stream = service.stream_chat(
        agent=request.app.state.agent,
        user_id=current_user.id,
        chat_request=chat_request,
    )

    response: StreamingResponse = AssistantTransportResponse(chat_stream)
    response.headers["Cache-Control"] = "no-cache, no-transform"

    return response
