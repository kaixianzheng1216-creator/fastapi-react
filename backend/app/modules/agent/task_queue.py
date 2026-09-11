from celery import Celery  # type: ignore[import-untyped]

from app.core.config import settings

AGENT_RUN_TASK_NAME = "agent.run"

celery_app = Celery(
    "app",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.modules.agent.tasks",
        "app.modules.conversations.tasks",
        "app.modules.data_refresh.tasks",
    ],
)

celery_app.conf.update(
    task_ignore_result=True,
    result_expires=3600,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
