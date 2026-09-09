import asyncio
import logging
import uuid
from collections.abc import Sequence

from sqlmodel import Session, col, select

from app.modules.file_library.exceptions import (
    LibraryDocumentNotFoundError,
)
from app.modules.file_library.models import LibraryDocument
from app.modules.file_library.schemas import (
    LibraryDocumentPublic,
    LibraryDocumentUploadPublic,
)
from app.modules.files import object_storage
from app.modules.files.exceptions import (
    FileSizeMismatchError,
    FileUploadIncompleteError,
)
from app.modules.files.models import StoredFile
from app.modules.files.object_storage import UPLOAD_HEADERS
from app.modules.files.schemas import FileUploadRequest
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def create_upload(
    *,
    session: Session,
    current_user: User,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    upload_request: FileUploadRequest,
) -> LibraryDocumentUploadPublic:
    document_id = uuid.uuid4()
    file_id = uuid.uuid4()

    object_key = object_storage.create_object_key(
        owner_id=current_user.id,
        file_id=file_id,
    )

    stored_file = StoredFile(
        id=file_id,
        owner_id=current_user.id,
        object_key=object_key,
        filename=upload_request.filename,
        content_type=upload_request.content_type,
        size=upload_request.size,
    )

    document = LibraryDocument(
        id=document_id,
        file_library_id=file_library_id,
        folder_id=folder_id,
        stored_file_id=file_id,
    )

    upload_url = object_storage.create_upload_url(object_key=object_key)

    session.add(stored_file)
    session.flush()
    session.add(document)
    session.commit()
    logger.info("Created library file upload %s", document_id)

    return LibraryDocumentUploadPublic(
        id=document_id,
        upload_url=upload_url,
        upload_headers=UPLOAD_HEADERS,
    )


async def complete_upload(
    *, session: Session, document_id: uuid.UUID
) -> LibraryDocumentPublic:
    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if stored_file.uploaded:
        return to_public(document, stored_file)

    object_key = stored_file.object_key
    expected_size = stored_file.size

    session.rollback()

    try:
        metadata = await asyncio.to_thread(object_storage.head_object, object_key)
    except FileNotFoundError:
        raise FileUploadIncompleteError from None

    if int(metadata["Content-Length"]) != expected_size:
        document, stored_file = _get_document_with_file(
            session=session,
            document_id=document_id,
            for_update=True,
        )

        if not stored_file.uploaded:
            await asyncio.to_thread(cleanup_objects, [stored_file.object_key])
            session.delete(document)
            session.flush()
            session.delete(stored_file)
            session.commit()

        raise FileSizeMismatchError

    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    if stored_file.uploaded:
        return to_public(document, stored_file)

    logger.info("Completed library file upload %s", document_id)
    stored_file.uploaded = True

    session.commit()

    return to_public(document, stored_file)


def get_document(*, session: Session, document_id: uuid.UUID) -> LibraryDocumentPublic:
    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    return to_public(document, stored_file)


def get_original_file(*, session: Session, document_id: uuid.UUID) -> StoredFile:
    _, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if not stored_file.uploaded:
        raise FileUploadIncompleteError

    return stored_file


def delete_document(*, session: Session, document_id: uuid.UUID) -> None:
    row = _get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    delete_document_records(session, [row])

    session.commit()


def delete_file_library_documents(
    *, session: Session, file_library_id: uuid.UUID
) -> None:
    rows = session.exec(
        select(LibraryDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == LibraryDocument.stored_file_id)
        .where(col(LibraryDocument.file_library_id) == file_library_id)
        .with_for_update()
    ).all()

    delete_document_records(session, rows)


def delete_document_records(
    session: Session,
    rows: Sequence[tuple[LibraryDocument, StoredFile]],
) -> None:
    # Keep records until storage deletion succeeds so failed deletions can be retried.
    cleanup_objects([stored_file.object_key for _, stored_file in rows])
    for document, _ in rows:
        session.delete(document)
    session.flush()
    for _, stored_file in rows:
        session.delete(stored_file)


def to_public(
    document: LibraryDocument, stored_file: StoredFile
) -> LibraryDocumentPublic:
    return LibraryDocumentPublic(
        id=document.id,
        file_library_id=document.file_library_id,
        folder_id=document.folder_id,
        filename=stored_file.filename,
        content_type=stored_file.content_type,
        size=stored_file.size,
        uploaded=stored_file.uploaded,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _get_document_with_file(
    *, session: Session, document_id: uuid.UUID, for_update: bool = False
) -> tuple[LibraryDocument, StoredFile]:
    statement = (
        select(LibraryDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == LibraryDocument.stored_file_id)
        .where(col(LibraryDocument.id) == document_id)
    )

    if for_update:
        statement = statement.with_for_update()

    result = session.exec(statement).first()

    if result is None:
        raise LibraryDocumentNotFoundError

    return result


def cleanup_objects(object_keys: list[str]) -> None:
    if not object_keys:
        return
    object_storage.delete_objects(object_keys)
    logger.info("Deleted %d library storage objects", len(object_keys))
