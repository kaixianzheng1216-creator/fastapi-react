import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    Index,
    String,
    text,
)
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class AgentRunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


ACTIVE_AGENT_RUN_STATUSES = (
    AgentRunStatus.QUEUED,
    AgentRunStatus.RUNNING,
)

TERMINAL_AGENT_RUN_STATUSES = frozenset(
    {
        AgentRunStatus.COMPLETED,
        AgentRunStatus.FAILED,
        AgentRunStatus.CANCELLED,
    }
)


class AgentRun(TimestampMixin, table=True):
    __tablename__ = "agent_run"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed', 'cancelled')",
            name="ck_agent_run_status",
        ),
        CheckConstraint(
            "(status IN ('queued', 'running') AND request_payload IS NOT NULL) "
            "OR (status IN ('completed', 'failed', 'cancelled') "
            "AND request_payload IS NULL)",
            name="ck_agent_run_request_payload",
        ),
        Index(
            "uq_agent_run_active_conversation",
            "conversation_id",
            unique=True,
            postgresql_where=text("status IN ('queued', 'running')"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id")
    conversation_id: uuid.UUID = Field(
        foreign_key="conversation.id",
        ondelete="CASCADE",
    )

    status: AgentRunStatus = Field(
        default=AgentRunStatus.QUEUED,
        sa_type=String(20),  # type: ignore
    )

    request_payload: dict[str, Any] | None = Field(
        default=None,
        sa_column=Column(JSON(none_as_null=True), nullable=True),
    )
