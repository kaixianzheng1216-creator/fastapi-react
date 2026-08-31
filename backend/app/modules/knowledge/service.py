import uuid
from collections.abc import Sequence
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

from psycopg.errors import UniqueViolation
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, delete, func, select

from app.modules.files.models import StoredFile
from app.modules.files.schemas import MAX_FILE_SIZE, FileUploadRequest
from app.modules.knowledge import documents, firecrawl
from app.modules.knowledge.exceptions import (
    KnowledgeBaseAlreadyExistsError,
    KnowledgeBaseNotFoundError,
    KnowledgeDocumentNotFoundError,
    KnowledgeFolderAlreadyExistsError,
    KnowledgeFolderInvalidParentError,
    KnowledgeFolderNotFoundError,
    WebpageTooLargeError,
)
from app.modules.knowledge.models import (
    KnowledgeBase,
    KnowledgeDocument,
    KnowledgeFolder,
)
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeDirectoryEntryPublic,
    KnowledgeDocumentEntryPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentUploadPublic,
    KnowledgeFolderCreate,
    KnowledgeFolderEntryPublic,
    KnowledgeFolderUpdate,
)
from app.modules.users.models import User


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
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    for_update: bool = False,
) -> KnowledgeBase:
    statement = select(KnowledgeBase).where(col(KnowledgeBase.id) == knowledge_base_id)

    if for_update:
        statement = statement.with_for_update()

    knowledge_base = session.exec(statement).first()

    if knowledge_base is None:
        raise KnowledgeBaseNotFoundError

    return knowledge_base


def create_knowledge_base(
    *, session: Session, knowledge_base_create: KnowledgeBaseCreate
) -> KnowledgeBase:
    knowledge_base = KnowledgeBase.model_validate(knowledge_base_create)

    session.add(knowledge_base)

    _commit(session)

    session.refresh(knowledge_base)

    return knowledge_base


def update_knowledge_base(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    knowledge_base_update: KnowledgeBaseUpdate,
) -> KnowledgeBase:
    knowledge_base = get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    knowledge_base.sqlmodel_update(knowledge_base_update.model_dump(exclude_unset=True))

    _commit(session)

    session.refresh(knowledge_base)

    return knowledge_base


def delete_knowledge_base(*, session: Session, knowledge_base_id: uuid.UUID) -> None:
    knowledge_base = get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    document_ids, object_keys = documents.delete_knowledge_base_documents(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    session.delete(knowledge_base)

    session.commit()

    documents.cleanup_deleted_documents(
        document_ids,
        object_keys,
        delete_images=True,
    )


def list_directory(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    skip: int,
    limit: int,
) -> tuple[list[KnowledgeDirectoryEntryPublic], int]:
    """分页获取当前目录，文件夹始终排在文档前。"""
    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    folder_conditions = (
        col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id,
        col(KnowledgeFolder.parent_id) == folder_id,
    )

    document_conditions = (
        col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id,
        col(KnowledgeDocument.folder_id) == folder_id,
    )

    folder_count = session.exec(
        select(func.count()).select_from(KnowledgeFolder).where(*folder_conditions)
    ).one()

    document_count = session.exec(
        select(func.count()).select_from(KnowledgeDocument).where(*document_conditions)
    ).one()

    entries: list[KnowledgeDirectoryEntryPublic] = []

    if skip < folder_count:
        folder_rows = session.exec(
            select(KnowledgeFolder)
            .where(*folder_conditions)
            .order_by(col(KnowledgeFolder.name), col(KnowledgeFolder.id))
            .offset(skip)
            .limit(limit)
        ).all()

        for folder in folder_rows:
            entries.append(
                KnowledgeFolderEntryPublic.model_validate(
                    folder,
                    update={"type": "folder"},
                )
            )

    document_skip = max(skip - folder_count, 0)

    document_limit = limit - len(entries)

    if document_limit > 0:
        document_statement = (
            select(KnowledgeDocument, StoredFile)
            .join(
                StoredFile,
                col(StoredFile.id) == KnowledgeDocument.stored_file_id,
            )
            .where(*document_conditions)
            .order_by(
                col(KnowledgeDocument.created_at).desc(),
                col(KnowledgeDocument.id).desc(),
            )
            .offset(document_skip)
            .limit(document_limit)
        )

        document_rows = session.exec(document_statement).all()

        for document, stored_file in document_rows:
            entries.append(
                KnowledgeDocumentEntryPublic.model_validate(
                    documents.to_public(document, stored_file),
                    update={"type": "document"},
                )
            )

    return entries, folder_count + document_count


def list_folders(
    *, session: Session, knowledge_base_id: uuid.UUID
) -> Sequence[KnowledgeFolder]:
    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)

    return session.exec(
        select(KnowledgeFolder)
        .where(col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id)
        .order_by(col(KnowledgeFolder.name), col(KnowledgeFolder.id))
    ).all()


def create_folder(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_create: KnowledgeFolderCreate,
) -> KnowledgeFolder:
    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_create.parent_id,
    )

    folder = KnowledgeFolder(
        knowledge_base_id=knowledge_base_id,
        parent_id=folder_create.parent_id,
        name=folder_create.name,
    )

    session.add(folder)

    _commit_folder(session)

    session.refresh(folder)

    return folder


def update_folder(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID,
    folder_update: KnowledgeFolderUpdate,
) -> KnowledgeFolder:
    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    folder = _get_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    folder.name = folder_update.name

    _commit_folder(session)

    session.refresh(folder)

    return folder


def move_folder(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID,
    target_parent_id: uuid.UUID | None,
) -> KnowledgeFolder:
    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    folders = session.exec(
        select(KnowledgeFolder).where(
            col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id
        )
    ).all()

    folders_by_id: dict[uuid.UUID, KnowledgeFolder] = {}

    for folder in folders:
        folders_by_id[folder.id] = folder

    folder_to_move = folders_by_id.get(folder_id)

    if folder_to_move is None or (
        target_parent_id is not None and target_parent_id not in folders_by_id
    ):
        raise KnowledgeFolderNotFoundError

    ancestor_id = target_parent_id

    while ancestor_id is not None:
        if ancestor_id == folder_id:
            raise KnowledgeFolderInvalidParentError

        ancestor_id = folders_by_id[ancestor_id].parent_id

    folder_to_move.parent_id = target_parent_id

    _commit_folder(session)

    session.refresh(folder_to_move)

    return folder_to_move


def create_document_upload(
    *,
    session: Session,
    current_user: User,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    upload_request: FileUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    return documents.create_upload(
        session=session,
        current_user=current_user,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        upload_request=upload_request,
    )


async def create_webpage_document(
    *,
    session: Session,
    current_user: User,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    url: str,
) -> KnowledgeDocumentPublic:
    """抓取网页并创建知识库文档。"""
    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    session.rollback()

    markdown, title = await firecrawl.scrape(url)

    content = markdown.encode("utf-8")

    if len(content) > MAX_FILE_SIZE:
        raise WebpageTooLargeError

    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    return await documents.create_webpage(
        session=session,
        current_user=current_user,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        source_url=url,
        filename=_create_webpage_filename(url, title),
        content=content,
    )


def move_document(
    *,
    session: Session,
    document_id: uuid.UUID,
    folder_id: uuid.UUID | None,
) -> KnowledgeDocumentPublic:
    knowledge_base_id = session.exec(
        select(KnowledgeDocument.knowledge_base_id).where(
            col(KnowledgeDocument.id) == document_id
        )
    ).first()

    if knowledge_base_id is None:
        raise KnowledgeDocumentNotFoundError

    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    document = session.get(KnowledgeDocument, document_id, with_for_update=True)

    if document is None:
        raise KnowledgeDocumentNotFoundError

    _validate_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
    )

    document.folder_id = folder_id

    session.commit()

    return documents.get_document(session=session, document_id=document_id)


def delete_directory_entries(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_ids: set[uuid.UUID],
    document_ids: set[uuid.UUID],
) -> None:
    get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        for_update=True,
    )

    affected_folder_ids: set[uuid.UUID] = set()

    if folder_ids:
        all_folders = session.exec(
            select(KnowledgeFolder).where(
                col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id
            )
        ).all()

        folders_by_id: dict[uuid.UUID, KnowledgeFolder] = {}

        for folder in all_folders:
            folders_by_id[folder.id] = folder

        if not folder_ids.issubset(folders_by_id):
            raise KnowledgeFolderNotFoundError

        for folder in all_folders:
            ancestor_id: uuid.UUID | None = folder.id

            while ancestor_id is not None:
                if ancestor_id in folder_ids:
                    affected_folder_ids.add(folder.id)
                    break

                ancestor_id = folders_by_id[ancestor_id].parent_id

    documents_with_files = session.exec(
        select(KnowledgeDocument, StoredFile)
        .join(
            StoredFile,
            col(StoredFile.id) == KnowledgeDocument.stored_file_id,
        )
        .where(
            col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id,
            or_(
                col(KnowledgeDocument.id).in_(document_ids),
                col(KnowledgeDocument.folder_id).in_(affected_folder_ids),
            ),
        )
        .with_for_update()
    ).all()

    existing_document_ids: set[uuid.UUID] = set()

    for document, _ in documents_with_files:
        existing_document_ids.add(document.id)

    if not document_ids.issubset(existing_document_ids):
        raise KnowledgeDocumentNotFoundError

    deleted_document_ids, deleted_object_keys = documents.delete_document_records(
        session,
        documents_with_files,
    )

    if folder_ids:
        session.exec(
            delete(KnowledgeFolder).where(
                col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id,
                col(KnowledgeFolder.id).in_(folder_ids),
            )
        )

    session.commit()

    documents.cleanup_deleted_documents(
        deleted_document_ids,
        deleted_object_keys,
        delete_images=True,
    )


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, UniqueViolation):
            raise KnowledgeBaseAlreadyExistsError from error

        raise


def _get_folder(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID,
) -> KnowledgeFolder:
    folder = session.exec(
        select(KnowledgeFolder).where(
            col(KnowledgeFolder.id) == folder_id,
            col(KnowledgeFolder.knowledge_base_id) == knowledge_base_id,
        )
    ).first()

    if folder is None:
        raise KnowledgeFolderNotFoundError

    return folder


def _validate_folder(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None,
) -> None:
    if folder_id is not None:
        _get_folder(
            session=session,
            knowledge_base_id=knowledge_base_id,
            folder_id=folder_id,
        )


def _commit_folder(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, UniqueViolation):
            raise KnowledgeFolderAlreadyExistsError from error

        raise


def _create_webpage_filename(url: str, title: str | None) -> str:
    if title:
        normalized_title = " ".join(title.split())

        if normalized_title:
            return f"{normalized_title[:252]}.md"

    parsed_url = urlsplit(url)

    assert parsed_url.hostname is not None

    path_name = PurePosixPath(unquote(parsed_url.path)).stem

    base_name = path_name or parsed_url.hostname

    return f"{base_name[:252]}.md"
