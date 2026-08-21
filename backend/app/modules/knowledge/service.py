import uuid
from collections.abc import Sequence

from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.modules.knowledge.exceptions import (
    KnowledgeBaseAlreadyExistsError,
    KnowledgeBaseNotFoundError,
)
from app.modules.knowledge.models import KnowledgeBase, get_datetime_utc
from app.modules.knowledge.schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate

UNIQUE_VIOLATION_SQLSTATE = "23505"


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if getattr(error.orig, "sqlstate", None) == UNIQUE_VIOLATION_SQLSTATE:
            raise KnowledgeBaseAlreadyExistsError from error
        raise


def create_knowledge_base(
    *, session: Session, knowledge_base_create: KnowledgeBaseCreate
) -> KnowledgeBase:
    knowledge_base = KnowledgeBase.model_validate(knowledge_base_create)

    session.add(knowledge_base)

    _commit(session)

    session.refresh(knowledge_base)

    return knowledge_base


def list_knowledge_bases(
    *,
    session: Session,
    skip: int,
    limit: int,
    search: str | None = None,
    is_enabled: bool | None = None,
) -> tuple[Sequence[KnowledgeBase], int]:
    filters: list[ColumnElement[bool]] = []

    if search:
        filters.append(
            col(KnowledgeBase.name).icontains(search.strip(), autoescape=True)
        )

    if is_enabled is not None:
        filters.append(col(KnowledgeBase.is_enabled) == is_enabled)

    count = session.exec(
        select(func.count()).select_from(KnowledgeBase).where(*filters)
    ).one()

    statement = (
        select(KnowledgeBase)
        .where(*filters)
        .order_by(col(KnowledgeBase.created_at).desc())
        .offset(skip)
        .limit(limit)
    )

    return session.exec(statement).all(), count


def get_knowledge_base(
    *, session: Session, knowledge_base_id: uuid.UUID
) -> KnowledgeBase:
    knowledge_base = session.get(KnowledgeBase, knowledge_base_id)

    if knowledge_base is None:
        raise KnowledgeBaseNotFoundError

    return knowledge_base


def update_knowledge_base(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    knowledge_base_update: KnowledgeBaseUpdate,
) -> KnowledgeBase:
    knowledge_base = get_knowledge_base(
        session=session, knowledge_base_id=knowledge_base_id
    )

    knowledge_base.sqlmodel_update(knowledge_base_update.model_dump(exclude_unset=True))

    knowledge_base.updated_at = get_datetime_utc()

    session.add(knowledge_base)

    _commit(session)

    session.refresh(knowledge_base)

    return knowledge_base


def delete_knowledge_base(*, session: Session, knowledge_base_id: uuid.UUID) -> None:
    from app.modules.knowledge import documents

    knowledge_base = get_knowledge_base(
        session=session, knowledge_base_id=knowledge_base_id
    )

    document_ids, object_keys = documents.delete_knowledge_base_documents(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    session.delete(knowledge_base)

    session.commit()

    documents.cleanup_deleted_documents(document_ids, object_keys)
