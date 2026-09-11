from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from kombu.exceptions import OperationalError  # type: ignore[import-untyped]
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.modules.agent.task_queue import celery_app
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.data_refresh.schemas import (
    CurrentRefreshJob,
    RefreshJob,
    RefreshSource,
    RefreshStatus,
)

router = APIRouter(
    prefix="/admin/data-refresh",
    tags=["data-refresh"],
    dependencies=[Depends(get_current_active_superuser)],
)


def _redis_client() -> Redis:
    return Redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=5,
    )


def _task_status(job_id: str) -> RefreshStatus:
    state = celery_app.AsyncResult(job_id).state

    if state == "SUCCESS":
        return RefreshStatus(status="succeeded")

    if state in {"FAILURE", "REVOKED"}:
        return RefreshStatus(status="failed")

    return RefreshStatus(status="pending")


@router.post("/{source}", response_model=RefreshJob, status_code=202)
def start_data_refresh(source: RefreshSource) -> RefreshJob:
    key = f"data-refresh:{source.value}:current"

    try:
        with (
            _redis_client() as client,
            client.lock(f"{key}:submit", timeout=15, blocking_timeout=1),
        ):
            current_id = client.get(key)

            if current_id and _task_status(str(current_id)).status == "pending":
                return RefreshJob(job_id=UUID(str(current_id)))

            job_id = uuid4()

            client.set(key, str(job_id), ex=3600)

            try:
                celery_app.send_task(
                    "data.refresh",
                    args=[source.value],
                    task_id=str(job_id),
                    expires=1800,
                    retry=False,
                )
            except OperationalError, RedisError:
                client.delete(key)
                raise

            return RefreshJob(job_id=job_id)
    except (OperationalError, RedisError) as error:
        raise HTTPException(status_code=503, detail="刷新服务暂不可用") from error


@router.get("/{source}", response_model=CurrentRefreshJob)
def read_current_refresh(source: RefreshSource) -> CurrentRefreshJob:
    try:
        with _redis_client() as client:
            job_id = client.get(f"data-refresh:{source.value}:current")

        if not job_id:
            return CurrentRefreshJob()

        status = _task_status(str(job_id))

        return CurrentRefreshJob(job_id=UUID(str(job_id)), status=status.status)
    except (OperationalError, RedisError) as error:
        raise HTTPException(status_code=503, detail="刷新服务暂不可用") from error


@router.get("/jobs/{job_id}", response_model=RefreshStatus)
def read_refresh_status(job_id: UUID) -> RefreshStatus:
    try:
        return _task_status(str(job_id))
    except (OperationalError, RedisError) as error:
        raise HTTPException(status_code=503, detail="刷新服务暂不可用") from error
