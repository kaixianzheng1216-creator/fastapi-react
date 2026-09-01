import asyncio
import logging
from collections.abc import AsyncGenerator
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.db.session import engine
from app.modules.agent.exceptions import (
    AgentRunActiveError,
    AgentRunNotFoundError,
    AgentRunQueueUnavailableError,
    AgentRunStreamExpiredError,
)
from app.modules.agent.models import (
    ACTIVE_AGENT_RUN_STATUSES,
    TERMINAL_AGENT_RUN_STATUSES,
    AgentRun,
    AgentRunStatus,
)
from app.modules.agent.run_stream import AgentRunStream
from app.modules.agent.schemas import (
    AgentChatRequest,
    AgentRunResumeStatePublic,
)
from app.modules.agent.task_queue import AGENT_RUN_TASK_NAME, celery_app
from app.modules.conversations import service as conversation_service
from app.modules.users.models import User

logger = logging.getLogger(__name__)


async def create_run(
    *,
    session: Session,
    current_user: User,
    request: AgentChatRequest,
) -> UUID:
    conversation_service.touch_conversation(
        session=session,
        current_user=current_user,
        conversation_id=request.thread_id,
    )

    run_id = uuid4()

    run = AgentRun(
        id=run_id,
        owner_id=current_user.id,
        conversation_id=request.thread_id,
        request_payload=request.model_dump(mode="json", by_alias=True),
    )

    session.add(run)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()

        active_run = _get_active_run(
            session=session,
            user_id=current_user.id,
            conversation_id=request.thread_id,
        )

        if active_run is not None:
            raise AgentRunActiveError from None

        raise

    try:
        await _dispatch_run(run_id)
    except AgentRunQueueUnavailableError:
        await asyncio.to_thread(finish_run, run_id, AgentRunStatus.FAILED)

        raise

    return run_id


async def _dispatch_run(run_id: UUID) -> None:
    try:
        await asyncio.to_thread(
            celery_app.send_task,
            AGENT_RUN_TASK_NAME,
            args=[str(run_id)],
            task_id=str(run_id),
        )
    except Exception as error:
        logger.exception("Agent 任务投递失败", extra={"run_id": str(run_id)})

        raise AgentRunQueueUnavailableError from error


async def read_resume_state(
    *,
    session: Session,
    user_id: UUID,
    conversation_id: UUID,
    stream: AgentRunStream,
) -> AgentRunResumeStatePublic | None:
    run = _get_active_run(
        session=session,
        user_id=user_id,
        conversation_id=conversation_id,
    )

    if run is None:
        return None

    run_id = run.id

    request_payload = run.request_payload

    if request_payload is None:
        raise RuntimeError("活动运行缺少请求数据")

    session.rollback()

    status = await _ensure_live(run_id, stream)

    if status is None or status in TERMINAL_AGENT_RUN_STATUSES:
        return None

    request = AgentChatRequest.model_validate(request_payload)

    return AgentRunResumeStatePublic(runId=run_id, state=request.state)


def _get_active_run(
    *,
    session: Session,
    user_id: UUID,
    conversation_id: UUID,
) -> AgentRun | None:
    return session.exec(
        select(AgentRun).where(
            AgentRun.owner_id == user_id,
            AgentRun.conversation_id == conversation_id,
            col(AgentRun.status).in_(ACTIVE_AGENT_RUN_STATUSES),
        )
    ).one_or_none()


async def prepare_resume(
    *,
    session: Session,
    user_id: UUID,
    run_id: UUID,
    stream: AgentRunStream,
) -> UUID:
    run = session.exec(
        select(AgentRun).where(AgentRun.id == run_id, AgentRun.owner_id == user_id)
    ).one_or_none()

    if run is None:
        raise AgentRunNotFoundError

    should_dispatch = run.status == AgentRunStatus.QUEUED

    session.rollback()

    if should_dispatch:
        await _dispatch_run(run_id)

    status = await _ensure_live(run_id, stream)

    if (
        status is None or status in TERMINAL_AGENT_RUN_STATUSES
    ) and not await stream.has_stream(run_id):
        raise AgentRunStreamExpiredError

    return run_id


async def stream_run(
    run_id: UUID,
    stream: AgentRunStream,
) -> AsyncGenerator[bytes]:
    async def should_stop() -> bool:
        status = await _ensure_live(run_id, stream)

        return status is None or status in TERMINAL_AGENT_RUN_STATUSES

    async for chunk in stream.stream(run_id, should_stop):
        yield chunk


async def _ensure_live(
    run_id: UUID,
    stream: AgentRunStream,
) -> AgentRunStatus | None:
    status = await asyncio.to_thread(_read_status, run_id)

    if status != AgentRunStatus.RUNNING:
        return status

    if await stream.has_heartbeat(run_id):
        return status

    return await asyncio.to_thread(_fail_run, run_id)


def _read_status(run_id: UUID) -> AgentRunStatus | None:
    with Session(engine) as session:
        run = session.get(AgentRun, run_id)

        if run is None:
            return None

        return run.status


def _fail_run(run_id: UUID) -> AgentRunStatus | None:
    with Session(engine) as session:
        run = session.exec(
            select(AgentRun).where(AgentRun.id == run_id).with_for_update()
        ).one_or_none()

        if run is None:
            return None

        if run.status != AgentRunStatus.RUNNING:
            return run.status

        _set_terminal(run, AgentRunStatus.FAILED)

        session.commit()

        return AgentRunStatus.FAILED


async def cancel_run(
    *,
    session: Session,
    user_id: UUID,
    run_id: UUID,
    stream: AgentRunStream,
) -> None:
    run = session.exec(
        select(AgentRun)
        .where(AgentRun.id == run_id, AgentRun.owner_id == user_id)
        .with_for_update()
    ).one_or_none()

    if run is None:
        raise AgentRunNotFoundError

    if run.status in TERMINAL_AGENT_RUN_STATUSES:
        return

    if run.status == AgentRunStatus.QUEUED:
        _set_terminal(run, AgentRunStatus.CANCELLED)

        session.commit()

        return

    session.rollback()

    await stream.request_cancel(run_id)


def claim_run(run_id: UUID) -> tuple[UUID, AgentChatRequest] | None:
    with Session(engine) as session:
        run = session.exec(
            select(AgentRun).where(AgentRun.id == run_id).with_for_update()
        ).one_or_none()

        if run is None or run.status != AgentRunStatus.QUEUED:
            return None

        if run.request_payload is None:
            raise ValueError("待执行任务缺少请求数据")

        request = AgentChatRequest.model_validate(run.request_payload)

        run.status = AgentRunStatus.RUNNING

        session.commit()

        return run.owner_id, request


def finish_run(
    run_id: UUID,
    status: AgentRunStatus,
) -> None:
    if status not in TERMINAL_AGENT_RUN_STATUSES:
        raise ValueError(f"无效的结束状态：{status}")

    with Session(engine) as session:
        run = session.exec(
            select(AgentRun).where(AgentRun.id == run_id).with_for_update()
        ).one_or_none()

        if run is None or run.status in TERMINAL_AGENT_RUN_STATUSES:
            return

        _set_terminal(run, status)

        session.commit()


def _set_terminal(
    run: AgentRun,
    status: AgentRunStatus,
) -> None:
    run.status = status

    run.request_payload = None
