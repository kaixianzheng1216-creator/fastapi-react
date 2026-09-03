import asyncio
import logging
import uuid
from collections.abc import Sequence
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.db.timestamps import utc_now
from app.modules.agent.models import (
    ACTIVE_AGENT_RUN_STATUSES,
    AgentRun,
    AgentRunStatus,
)
from app.modules.agent.task_queue import celery_app
from app.modules.conversations.exceptions import (
    ConversationDeleteQueueError,
    ConversationNotFoundError,
    ConversationRunActiveError,
    ConversationTitleGenerationError,
)
from app.modules.conversations.file_service import delete_file_links
from app.modules.conversations.message_files import refresh_message_file_urls
from app.modules.conversations.models import Conversation, ConversationKind
from app.modules.conversations.schemas import (
    ConversationDetailPublic,
    ConversationPublic,
    ConversationStatePublic,
)
from app.modules.files.service import (
    cleanup_objects,
    delete_file_records,
)
from app.modules.users.models import User

DEFAULT_CONVERSATION_TITLE = "新对话"
DEFAULT_RESEARCH_TITLE = "新调研"
DELETE_TASK = "conversation.delete"
MAX_CONVERSATION_TITLE_LENGTH = 100
TITLE_SYSTEM_PROMPT = (
    "根据用户的第一条消息生成一个简短、准确的会话标题。"
    "只输出标题，不要引号、句号、Markdown 或解释。"
)
TITLE_TRACE_NAME = "conversation-title"
TITLE_GENERATION_ERROR_LOG = "生成会话标题失败"
CONVERSATION_CLEANUP_ERROR_LOG = "清理对话检查点失败"
logger = logging.getLogger(__name__)


def create_conversation(
    *,
    session: Session,
    current_user: User,
    kind: ConversationKind,
) -> Conversation:
    conversation = Conversation(owner_id=current_user.id, kind=kind)
    session.add(conversation)
    session.commit()
    session.refresh(conversation)

    return conversation


async def generate_conversation_title(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
    text: str,
    title_model: BaseChatModel,
) -> Conversation:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    if conversation.title is not None:
        return conversation

    try:
        with propagate_attributes(
            trace_name=TITLE_TRACE_NAME,
            user_id=str(current_user.id),
            session_id=f"{current_user.id}:{conversation.id}",
        ):
            response = await title_model.ainvoke(
                [SystemMessage(TITLE_SYSTEM_PROMPT), HumanMessage(text)],
                config={"callbacks": [CallbackHandler()]},
            )
    except Exception:
        logger.exception(TITLE_GENERATION_ERROR_LOG)
        raise ConversationTitleGenerationError from None

    conversation.title = response.text[:MAX_CONVERSATION_TITLE_LENGTH]
    session.commit()
    session.refresh(conversation)

    return conversation


def list_conversations(
    *,
    session: Session,
    current_user: User,
    offset: int,
    limit: int,
    search: str | None = None,
    archived: bool | None = None,
) -> tuple[Sequence[Conversation], int]:
    filters: list[ColumnElement[bool]] = [
        col(Conversation.owner_id) == current_user.id,
        col(Conversation.deleting_at).is_(None),
    ]

    if search is not None:
        filters.append(col(Conversation.title).contains(search))

    if archived is not None:
        filters.append(col(Conversation.archived) == archived)

    count_statement = select(func.count()).select_from(Conversation).where(*filters)

    statement = (
        select(Conversation)
        .where(*filters)
        .order_by(col(Conversation.updated_at).desc())
        .offset(offset)
        .limit(limit)
    )

    count = session.exec(count_statement).one()
    conversations = session.exec(statement).all()

    return conversations, count


async def get_conversation_detail(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
    resources: Any,
) -> ConversationDetailPublic:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    agent = resources.get_agent(conversation.kind)

    snapshot = await agent.aget_state(
        {
            "configurable": {
                "thread_id": f"{current_user.id}:{conversation.id}",
            }
        }
    )

    values = snapshot.values

    run_status = None

    if conversation.kind == ConversationKind.RESEARCH:
        latest_run_status = session.exec(
            select(AgentRun.status)
            .where(
                AgentRun.owner_id == current_user.id,
                AgentRun.conversation_id == conversation.id,
            )
            .order_by(col(AgentRun.created_at).desc())
            .limit(1)
        ).first()

        run_status = (
            AgentRunStatus(latest_run_status) if latest_run_status is not None else None
        )

    state = ConversationStatePublic(
        messages=[
            refresh_message_file_urls(message, current_user.id).model_dump(mode="json")
            for message in values.get("messages", [])
        ],
        todos=values.get("todos", []),
        artifacts=values.get("artifacts", []),
        stage=values.get("stage"),
        run_status=run_status,
        plan=values.get("plan"),
        research_messages=values.get("research_messages", []),
        outline=values.get("outline"),
        draft=values.get("draft"),
        report=values.get("report"),
    )

    return ConversationDetailPublic(
        **to_public(conversation).model_dump(),
        state=state,
    )


def rename_conversation(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
    title: str,
) -> Conversation:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )
    conversation.title = title
    session.commit()
    session.refresh(conversation)

    return conversation


def archive_conversation(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
) -> Conversation:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )
    conversation.archived = True
    session.commit()
    session.refresh(conversation)

    return conversation


def unarchive_conversation(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
) -> Conversation:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )
    conversation.archived = False
    session.commit()
    session.refresh(conversation)

    return conversation


async def request_delete(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
) -> None:
    conversation = session.exec(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.owner_id == current_user.id,
        )
        .with_for_update()
    ).one_or_none()

    if conversation is None:
        session.rollback()

        return

    if conversation.deleting_at is not None:
        session.rollback()

        return

    conversation.deleting_at = utc_now()

    session.flush()

    try:
        await asyncio.to_thread(
            celery_app.send_task,
            DELETE_TASK,
            args=[str(conversation.id), str(current_user.id)],
        )
    except Exception as error:
        session.rollback()

        logger.exception(
            "会话删除任务投递失败",
            extra={"conversation_id": str(conversation.id)},
        )

        raise ConversationDeleteQueueError from error

    session.commit()


def is_deleting(
    *,
    session: Session,
    owner_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> bool:
    conversation = session.exec(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.owner_id == owner_id,
        )
        .with_for_update()
    ).one_or_none()

    deleting = conversation is not None and conversation.deleting_at is not None

    session.rollback()

    return deleting


async def finish_delete(
    *,
    session: Session,
    owner_id: uuid.UUID,
    conversation_id: uuid.UUID,
    checkpointer: AsyncPostgresSaver,
) -> None:
    conversation = session.exec(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.owner_id == owner_id,
            col(Conversation.deleting_at).is_not(None),
        )
        .with_for_update()
    ).one_or_none()

    if conversation is None:
        session.rollback()
        return

    run_id = session.exec(
        select(AgentRun.id).where(
            AgentRun.owner_id == owner_id,
            AgentRun.conversation_id == conversation.id,
            col(AgentRun.status).in_(ACTIVE_AGENT_RUN_STATUSES),
        )
    ).first()

    if run_id is not None:
        raise ConversationRunActiveError

    file_ids = delete_file_links(
        session=session,
        conversation_id=conversation.id,
    )

    session.flush()

    object_keys = delete_file_records(session=session, file_ids=file_ids)

    session.flush()

    session.delete(conversation)

    session.commit()

    await asyncio.to_thread(cleanup_objects, object_keys)

    try:
        await checkpointer.adelete_thread(f"{owner_id}:{conversation_id}")
    except Exception:
        logger.exception(
            CONVERSATION_CLEANUP_ERROR_LOG,
            extra={"conversation_id": str(conversation_id)},
        )


def get_conversation(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
) -> Conversation:
    conversation = session.exec(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.owner_id == current_user.id,
            col(Conversation.deleting_at).is_(None),
        )
    ).one_or_none()

    if conversation is None:
        raise ConversationNotFoundError

    return conversation


def to_public(conversation: Conversation) -> ConversationPublic:
    return ConversationPublic(
        id=conversation.id,
        title=conversation.title
        or (
            DEFAULT_RESEARCH_TITLE
            if conversation.kind == ConversationKind.RESEARCH
            else DEFAULT_CONVERSATION_TITLE
        ),
        archived=conversation.archived,
        kind=conversation.kind,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )
