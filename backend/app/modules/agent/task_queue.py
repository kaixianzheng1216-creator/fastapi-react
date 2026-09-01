from celery import Celery  # type: ignore[import-untyped]

from app.core.config import settings

AGENT_RUN_TASK_NAME = "agent.run"

celery_app = Celery(
    "app",
    broker=settings.CELERY_BROKER_URL,
    include=["app.modules.agent.tasks"],
)
