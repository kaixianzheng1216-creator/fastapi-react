import asyncio
from uuid import UUID

from sqlmodel import Session

from app.core.config import settings
from app.db.session import engine
from app.modules.agent import run_service
from app.modules.agent.resources import open_agent_checkpointer
from app.modules.agent.run_stream import AgentRunStream
from app.modules.agent.task_queue import celery_app
from app.modules.conversations import service


@celery_app.task(  # type: ignore[untyped-decorator]
    name=service.DELETE_TASK,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def delete_conversation(conversation_id: str, owner_id: str) -> None:
    asyncio.run(
        _delete_conversation(
            conversation_id=UUID(conversation_id),
            owner_id=UUID(owner_id),
        )
    )


async def _delete_conversation(
    *,
    conversation_id: UUID,
    owner_id: UUID,
) -> None:
    with Session(engine) as session:
        if not service.is_deleting(
            session=session,
            owner_id=owner_id,
            conversation_id=conversation_id,
        ):
            return

        stream = AgentRunStream(redis_url=settings.REDIS_URL)

        try:
            await stream.connect()

            await run_service.stop_conversation_run(
                session=session,
                user_id=owner_id,
                conversation_id=conversation_id,
                stream=stream,
            )
        finally:
            await stream.close()

        async with open_agent_checkpointer() as checkpointer:
            await service.finish_delete(
                session=session,
                owner_id=owner_id,
                conversation_id=conversation_id,
                checkpointer=checkpointer,
            )
