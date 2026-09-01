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
from app.modules.agent.models import ACTIVE_AGENT_RUN_STATUSES, AgentRun
from app.modules.conversations.exceptions import (
    ConversationNotFoundError,
    ConversationRunActiveError,
    ConversationTitleGenerationError,
)
from app.modules.conversations.file_service import delete_file_links
from app.modules.conversations.message_files import refresh_message_file_urls
from app.modules.conversations.models import Conversation
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
MAX_CONVERSATION_TITLE_LENGTH = 100
TITLE_SYSTEM_PROMPT = (
    "根据用户的第一条消息生成一个简短、准确的会话标题。"
    "只输出标题，不要引号、句号、Markdown 或解释。"
)
TITLE_TRACE_NAME = "conversation-title"
TITLE_GENERATION_ERROR_LOG = "生成会话标题失败"
CONVERSATION_CLEANUP_ERROR_LOG = "清理对话检查点失败"
logger = logging.getLogger(__name__)


def create_conversation(*, session: Session, current_user: User) -> Conversation:
    conversation = Conversation(owner_id=current_user.id)
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
    filters: list[ColumnElement[bool]] = [col(Conversation.owner_id) == current_user.id]

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
    agent: Any,
) -> ConversationDetailPublic:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    snapshot = await agent.aget_state(
        {
            "configurable": {
                "thread_id": f"{current_user.id}:{conversation.id}",
            }
        }
    )

    values = snapshot.values

    state = ConversationStatePublic(
        messages=[
            refresh_message_file_urls(message, current_user.id).model_dump(mode="json")
            for message in values.get("messages", [])
        ],
        todos=values.get("todos", []),
        artifacts=values.get("artifacts", []),
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


async def delete_conversation(
    *,
    session: Session,
    current_user: User,
    conversation_id: uuid.UUID,
    checkpointer: AsyncPostgresSaver,
) -> None:
    conversation = get_conversation(
        session=session,
        current_user=current_user,
        conversation_id=conversation_id,
    )

    session.refresh(conversation, with_for_update=True)

    active_run_id = session.exec(
        select(AgentRun.id).where(
            AgentRun.owner_id == current_user.id,
            AgentRun.conversation_id == conversation.id,
            col(AgentRun.status).in_(ACTIVE_AGENT_RUN_STATUSES),
        )
    ).first()

    if active_run_id is not None:
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
        await checkpointer.adelete_thread(f"{current_user.id}:{conversation_id}")
    except Exception:
        logger.exception(
            CONVERSATION_CLEANUP_ERROR_LOG,
            extra={"conversation_id": str(conversation_id)},
        )


def touch_conversation(
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

    conversation.updated_at = utc_now()

    session.add(conversation)

    return conversation


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
        )
    ).one_or_none()

    if conversation is None:
        raise ConversationNotFoundError

    return conversation


def to_public(conversation: Conversation) -> ConversationPublic:
    return ConversationPublic(
        id=conversation.id,
        title=conversation.title or DEFAULT_CONVERSATION_TITLE,
        archived=conversation.archived,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )
