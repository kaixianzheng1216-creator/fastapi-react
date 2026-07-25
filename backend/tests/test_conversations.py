import asyncio
import uuid
from types import SimpleNamespace
from unittest import TestCase

from pydantic import ValidationError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.db import models  # noqa: F401
from app.modules.conversations import service
from app.modules.conversations.exceptions import ConversationNotFoundError
from app.modules.conversations.models import Conversation
from app.modules.conversations.schemas import ConversationRenameRequest


class FakeCheckpointer:
    def __init__(self) -> None:
        self.deleted_thread_ids: list[str] = []

    async def adelete_thread(self, thread_id: str) -> None:
        self.deleted_thread_ids.append(thread_id)


class ConversationServiceTest(TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(
            self.engine,
            tables=[Conversation.__table__],
        )
        self.session = Session(self.engine)
        self.current_user = SimpleNamespace(id=uuid.uuid4())
        self.conversation = Conversation(owner_id=self.current_user.id)
        self.session.add(self.conversation)
        self.session.commit()
        self.session.refresh(self.conversation)

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def test_rename_archive_and_unarchive(self) -> None:
        renamed = service.rename_conversation(
            session=self.session,
            current_user=self.current_user,  # type: ignore[arg-type]
            conversation_id=self.conversation.id,
            title="新标题",
        )
        self.assertEqual(renamed.title, "新标题")

        archived = service.archive_conversation(
            session=self.session,
            current_user=self.current_user,  # type: ignore[arg-type]
            conversation_id=self.conversation.id,
        )
        self.assertTrue(archived.archived)

        unarchived = service.unarchive_conversation(
            session=self.session,
            current_user=self.current_user,  # type: ignore[arg-type]
            conversation_id=self.conversation.id,
        )
        self.assertFalse(unarchived.archived)

    def test_other_user_cannot_modify_conversation(self) -> None:
        with self.assertRaises(ConversationNotFoundError):
            service.archive_conversation(
                session=self.session,
                current_user=SimpleNamespace(id=uuid.uuid4()),  # type: ignore[arg-type]
                conversation_id=self.conversation.id,
            )

    def test_delete_removes_checkpoint_and_metadata(self) -> None:
        checkpointer = FakeCheckpointer()

        asyncio.run(
            service.delete_conversation(
                session=self.session,
                current_user=self.current_user,  # type: ignore[arg-type]
                conversation_id=self.conversation.id,
                checkpointer=checkpointer,  # type: ignore[arg-type]
            )
        )

        self.assertEqual(
            checkpointer.deleted_thread_ids,
            [f"{self.current_user.id}:{self.conversation.id}"],
        )
        self.assertIsNone(
            self.session.exec(
                select(Conversation).where(
                    Conversation.id == self.conversation.id
                )
            ).one_or_none()
        )

    def test_rename_rejects_blank_title(self) -> None:
        with self.assertRaises(ValidationError):
            ConversationRenameRequest(title="   ")
