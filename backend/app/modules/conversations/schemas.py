import uuid
from datetime import datetime
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.modules.agent.models import AgentRunStatus
from app.modules.agent.schemas import Message, TextMessagePart
from app.modules.conversations.models import ConversationKind


class ConversationCreate(BaseModel):
    kind: ConversationKind = ConversationKind.CHAT


class ConversationPublic(BaseModel):
    id: uuid.UUID
    title: str
    archived: bool
    kind: ConversationKind
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class ConversationTitleRequest(Message):
    @model_validator(mode="after")
    def require_text(self) -> Self:
        if not self.text:
            raise ValueError("生成标题需要文本消息")

        return self

    @property
    def text(self) -> str:
        return "\n".join(
            part.text.strip()
            for part in self.parts
            if isinstance(part, TextMessagePart) and part.text.strip()
        )


class ConversationRenameRequest(BaseModel):
    title: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    ]


class ConversationsPublic(BaseModel):
    data: list[ConversationPublic]
    count: int


class TodoPublic(BaseModel):
    content: str
    status: Literal["pending", "in_progress", "completed"]


class ArtifactPublic(BaseModel):
    name: str
    url: str
    content_type: str = Field(alias="contentType")


ResearchStage = Literal[
    "plan",
    "research",
    "outline",
    "draft",
    "finalize",
    "complete",
]


class ResearchPeriodPublic(BaseModel):
    start: str
    end: str


class ResearchPlanPublic(BaseModel):
    intent: str
    period: ResearchPeriodPublic | None
    questions: list[str]
    metrics: list[str]


class ConversationStatePublic(BaseModel):
    messages: list[dict[str, Any]]
    todos: list[TodoPublic]
    artifacts: list[ArtifactPublic]
    stage: ResearchStage | None = None
    run_status: AgentRunStatus | None = Field(
        default=None,
        serialization_alias="runStatus",
    )
    run_started_at: datetime | None = Field(
        default=None,
        serialization_alias="runStartedAt",
    )
    run_finished_at: datetime | None = Field(
        default=None,
        serialization_alias="runFinishedAt",
    )
    run_error: str | None = Field(
        default=None,
        serialization_alias="runError",
    )
    plan: ResearchPlanPublic | None = None
    research_messages: list[dict[str, Any]] = Field(
        default_factory=list,
        serialization_alias="researchMessages",
    )
    outline: str | None = None
    draft: str | None = None
    report: str | None = None


class ConversationDetailPublic(ConversationPublic):
    state: ConversationStatePublic
