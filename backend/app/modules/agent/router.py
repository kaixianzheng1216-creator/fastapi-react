from assistant_stream.serialization import (  # type: ignore[import-untyped]
    AssistantTransportResponse,
)
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.agent import service
from app.modules.agent.config import settings
from app.modules.agent.exceptions import ModelsUnavailableError
from app.modules.agent.schemas import (
    AgentChatRequest,
    AgentModelPublic,
    AgentModelsPublic,
)
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.conversations import service as conversation_service
from app.modules.conversations.exceptions import ConversationNotFoundError

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
    ),
)


@router.get(
    "/models",
    response_model=AgentModelsPublic,
    responses=error_responses(ModelsUnavailableError),
)
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


@router.post(
    "/chat",
    responses=error_responses(ConversationNotFoundError),
)
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
        session=session,
        user_id=current_user.id,
        chat_request=chat_request,
    )

    response: StreamingResponse = AssistantTransportResponse(chat_stream)
    response.headers["Cache-Control"] = "no-cache, no-transform"

    return response
