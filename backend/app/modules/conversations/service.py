import logging
import uuid
from collections.abc import Sequence
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langfuse import propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlmodel import Session, col, func, select

from app.modules.conversations.exceptions import (
    ConversationNotFoundError,
    ConversationTitleGenerationError,
)
from app.modules.conversations.models import Conversation, get_datetime_utc
from app.modules.conversations.schemas import (
    ConversationDetailPublic,
    ConversationPublic,
    ConversationStatePublic,
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
    conversation.updated_at = get_datetime_utc()
    session.commit()
    session.refresh(conversation)

    return conversation


def list_conversations(
    *,
    session: Session,
    current_user: User,
    offset: int,
    limit: int,
) -> tuple[Sequence[Conversation], int]:
    owner_filter = Conversation.owner_id == current_user.id

    count_statement = (
        select(func.count())
        .select_from(Conversation)
        .where(owner_filter)
    )

    statement = (
        select(Conversation)
        .where(owner_filter)
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
            message.model_dump(mode="json") for message in values.get("messages", [])
        ],
        todos=values.get("todos", []),
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
    conversation.updated_at = get_datetime_utc()
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
    conversation.updated_at = get_datetime_utc()
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
    conversation.updated_at = get_datetime_utc()
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
    await checkpointer.adelete_thread(f"{current_user.id}:{conversation.id}")
    session.delete(conversation)
    session.commit()


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

    conversation.updated_at = get_datetime_utc()

    session.add(conversation)

    session.commit()

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
