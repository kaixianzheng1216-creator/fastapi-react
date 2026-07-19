from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.modules.agent import service
from app.modules.agent.schemas import AgentChatRequest
from app.modules.auth.dependencies import CurrentUser

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat")
async def chat(body: AgentChatRequest, current_user: CurrentUser) -> StreamingResponse:
    events = service.stream_chat(
        user_id=current_user.id,
        conversation_id=body.conversation_id,
        message=body.message,
    )

    response = StreamingResponse(
        events,
        media_type="text/event-stream",
    )

    return response
