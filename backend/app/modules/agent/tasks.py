import asyncio
import contextlib
import logging
from uuid import UUID

from assistant_stream.serialization import (  # type: ignore[import-untyped]
    AssistantTransportEncoder,
)
from celery.signals import worker_process_init  # type: ignore[import-untyped]
from sqlmodel import Session

from app.core.config import settings
from app.db.session import engine
from app.modules.agent import run_service, service
from app.modules.agent.connections.litellm_mcp import load_litellm_mcp_tools
from app.modules.agent.models import AgentRunStatus
from app.modules.agent.resources import open_agent_resources
from app.modules.agent.run_stream import (
    HEARTBEAT_INTERVAL_SECONDS,
    AgentRunStream,
)
from app.modules.agent.schemas import AgentChatRequest
from app.modules.agent.task_queue import AGENT_RUN_TASK_NAME, celery_app

RUN_INTERRUPTED_DETAIL = "服务中断，请重试"
RUN_FAILED_DETAIL = "Agent 运行失败"
logger = logging.getLogger(__name__)


@worker_process_init.connect  # type: ignore[untyped-decorator]
def warm_agent_worker(**_kwargs: object) -> None:
    """在 worker 启动阶段加载远程工具，避免首条消息承担发现耗时。"""
    try:
        asyncio.run(load_litellm_mcp_tools())

        logger.info("Agent Worker 依赖预热完成")
    except Exception:
        logger.exception("Agent Worker 依赖预热失败")


@celery_app.task(  # type: ignore[untyped-decorator]
    name=AGENT_RUN_TASK_NAME,
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_agent(run_id: str) -> None:
    asyncio.run(_run_agent(UUID(run_id)))


async def _run_agent(run_id: UUID) -> None:
    stream = AgentRunStream(redis_url=settings.REDIS_URL)

    run_claimed = False

    control_task: asyncio.Task[None] | None = None

    try:
        # 1. 连接并领取任务。
        await stream.connect()

        claimed = await asyncio.to_thread(run_service.claim_run, run_id)

        if claimed is None:
            return

        user_id, request = claimed

        run_claimed = True

        # 2. 启动心跳与取消监控。
        await stream.refresh_heartbeat(run_id)

        producer_task = asyncio.current_task()

        if producer_task is None:
            raise RuntimeError("无法获取当前 Agent Worker 任务")

        control_task = asyncio.create_task(
            _watch_control(stream, run_id, producer_task),
            name=f"agent-run-control-{run_id}",
        )

        # 3. 执行 Agent 并写入流。
        status = await _execute_agent(
            run_id,
            user_id,
            request,
            stream,
        )

        await _finish_run(run_id, status)
    except asyncio.CancelledError:
        # 4. 处理取消或中断。
        if not run_claimed:
            raise

        cancelled = False

        with contextlib.suppress(Exception):
            cancelled = await stream.is_cancel_requested(run_id)

        status = AgentRunStatus.CANCELLED if cancelled else AgentRunStatus.FAILED

        if not cancelled:
            with contextlib.suppress(Exception):
                await asyncio.shield(
                    stream.append_error(run_id, RUN_INTERRUPTED_DETAIL)
                )

        await asyncio.shield(_finish_run(run_id, status))

        if not cancelled:
            raise RuntimeError(RUN_INTERRUPTED_DETAIL) from None
    except Exception:
        # 5. 记录失败并通知客户端。
        logger.exception("任务失败", extra={"run_id": str(run_id)})

        with contextlib.suppress(Exception):
            await stream.append_error(run_id, RUN_FAILED_DETAIL)

        await _finish_run(run_id, AgentRunStatus.FAILED)

        raise
    finally:
        # 6. 停止监控并清理资源。
        if control_task is not None:
            control_task.cancel()

            with contextlib.suppress(asyncio.CancelledError, Exception):
                await control_task

        if run_claimed:
            with contextlib.suppress(Exception):
                await stream.finalize(run_id)

        with contextlib.suppress(Exception):
            await stream.close()


async def _watch_control(
    stream: AgentRunStream,
    run_id: UUID,
    producer_task: asyncio.Task[None],
) -> None:
    try:
        while True:
            if await stream.is_cancel_requested(run_id):
                producer_task.cancel()
                return

            await stream.refresh_heartbeat(run_id)

            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
    except Exception:
        logger.exception(
            "任务监控失败",
            extra={"run_id": str(run_id)},
        )

        producer_task.cancel()

        raise


async def _execute_agent(
    run_id: UUID,
    user_id: UUID,
    request: AgentChatRequest,
    stream: AgentRunStream,
) -> AgentRunStatus:
    async with open_agent_resources() as resources:
        with Session(engine) as session:
            outcome = service.RunOutcome()

            chunks = service.stream_chat(
                agent=resources.agent,
                session=session,
                user_id=user_id,
                chat_request=request,
                outcome=outcome,
            )

            encoder = AssistantTransportEncoder()

            async for chunk in encoder.encode_stream(chunks):
                await stream.append(run_id, chunk.encode())

    return AgentRunStatus.FAILED if outcome.failed else AgentRunStatus.COMPLETED


async def _finish_run(run_id: UUID, status: AgentRunStatus) -> None:
    await asyncio.to_thread(run_service.finish_run, run_id, status)
