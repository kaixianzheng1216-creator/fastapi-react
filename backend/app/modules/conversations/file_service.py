import uuid

from sqlmodel import Session, col, select

from app.modules.conversations.models import ConversationFile
from app.modules.files import service as file_service
from app.modules.files.exceptions import FileNotFoundError
from app.modules.files.models import StoredFile


def attach_file(
    *,
    session: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    reference: str,
) -> StoredFile:
    stored_file = file_service.resolve_file_reference(
        session=session,
        user_id=user_id,
        reference=reference,
    )

    conversation_file = session.get(ConversationFile, stored_file.id)

    if conversation_file is None:
        session.add(
            ConversationFile(
                stored_file_id=stored_file.id,
                conversation_id=conversation_id,
            )
        )
    elif conversation_file.conversation_id != conversation_id:
        raise FileNotFoundError

    return stored_file


def list_file_ids(
    *,
    session: Session,
    conversation_id: uuid.UUID,
) -> list[uuid.UUID]:
    statement = select(ConversationFile.stored_file_id).where(
        col(ConversationFile.conversation_id) == conversation_id
    )

    return list(session.exec(statement).all())
