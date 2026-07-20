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
    body: AgentChatRequest,
    current_user: CurrentUser,
) -> StreamingResponse:
    events = service.stream_chat(
        agent=request.app.state.agent,
        user_id=current_user.id,
        conversation_id=body.conversation_id,
        message=body.message,
    )

    response = StreamingResponse(
        events,
        media_type="text/event-stream",
    )

    return response
