from assistant_stream.serialization import (  # type: ignore[import-untyped]
    AssistantTransportResponse,
)
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.modules.agent import service
from app.modules.agent.schemas import AgentChatRequest
from app.modules.auth.dependencies import CurrentUser, get_current_user

router = APIRouter(
    prefix="/agent",
    tags=["agent"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/chat")
async def chat(
    request: Request,
    current_user: CurrentUser,
    chat_request: AgentChatRequest,
) -> StreamingResponse:
    chat_stream = service.stream_chat(
        agent=request.app.state.agent,
        user_id=current_user.id,
        chat_request=chat_request,
    )

    response: StreamingResponse = AssistantTransportResponse(chat_stream)
    response.headers["Cache-Control"] = "no-cache, no-transform"

    return response
