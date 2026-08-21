import asyncio
import json
import logging
import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import cast

import magic  # type: ignore[import-untyped]
from sqlmodel import Session, col, func, select

from app.modules.files import object_storage
from app.modules.files.constants import KNOWLEDGE_CONTENT_TYPES, TEXT_CONTENT_TYPES
from app.modules.files.exceptions import (
    FileContentTypeMismatchError,
    FileSizeMismatchError,
    FileTypeNotAllowedError,
    FileUploadIncompleteError,
    TextFileEncodingError,
)
from app.modules.files.models import StoredFile
from app.modules.files.object_storage import UPLOAD_HEADERS
from app.modules.files.service import cleanup_objects
from app.modules.knowledge import vector_store
from app.modules.knowledge.exceptions import (
    KnowledgeDocumentNotFoundError,
    KnowledgeDocumentPreviewUnavailableError,
    KnowledgeDocumentStateError,
)
from app.modules.knowledge.models import (
    KnowledgeDocument,
    get_datetime_utc,
)
from app.modules.knowledge.schemas import (
    KnowledgeDocumentPreviewPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentStatus,
    KnowledgeDocumentUploadPublic,
    KnowledgeDocumentUploadRequest,
)
from app.modules.users.models import User

FILE_HEADER_READ_BYTES = 8192
DOCUMENT_JSON_PATH = "knowledge/{document_id}/document.json"
DOCUMENT_PREVIEW_PATH = "knowledge/{document_id}/preview.md"
EXTERNAL_CLEANUP_ERROR_LOG = "清理知识库文档外部资源失败"

logger = logging.getLogger(__name__)


def document_json_key(document_id: uuid.UUID) -> str:
    return DOCUMENT_JSON_PATH.format(document_id=document_id)


def document_preview_key(document_id: uuid.UUID) -> str:
    return DOCUMENT_PREVIEW_PATH.format(document_id=document_id)


def create_upload(
    *,
    session: Session,
    current_user: User,
    knowledge_base_id: uuid.UUID,
    upload_request: KnowledgeDocumentUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    from app.modules.knowledge.service import get_knowledge_base

    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)

    if upload_request.content_type not in KNOWLEDGE_CONTENT_TYPES:
        raise FileTypeNotAllowedError

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
    document = KnowledgeDocument(
        id=document_id,
        knowledge_base_id=knowledge_base_id,
        stored_file_id=file_id,
    )

    session.add(stored_file)
    session.add(document)
    session.commit()

    return KnowledgeDocumentUploadPublic(
        id=document_id,
        upload_url=object_storage.create_upload_url(object_key=object_key),
        upload_headers=UPLOAD_HEADERS,
    )


async def complete_upload(
    *, session: Session, document_id: uuid.UUID
) -> KnowledgeDocumentPublic:
    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if stored_file.uploaded:
        return to_public(document, stored_file)

    object_key = stored_file.object_key
    expected_size = stored_file.size
    content_type = stored_file.content_type
    session.rollback()

    metadata = await asyncio.to_thread(object_storage.head_object, object_key)

    if int(metadata["Content-Length"]) != expected_size:
        await _delete_invalid_upload(session, document_id)
        raise FileSizeMismatchError

    try:
        if content_type in TEXT_CONTENT_TYPES:
            content = await asyncio.to_thread(
                object_storage.read_object_content,
                object_key=object_key,
                size=expected_size,
            )
            _validate_text_content(content, content_type)
        else:
            header = await asyncio.to_thread(
                object_storage.read_object_content,
                object_key=object_key,
                size=min(FILE_HEADER_READ_BYTES, expected_size),
            )
            detected_content_type = str(magic.from_buffer(header, mime=True))

            if detected_content_type != content_type:
                raise FileContentTypeMismatchError
    except FileContentTypeMismatchError, TextFileEncodingError:
        await _delete_invalid_upload(session, document_id)
        raise

    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    if stored_file.uploaded:
        return to_public(document, stored_file)

    stored_file.uploaded = True
    session.add(stored_file)
    session.commit()

    return to_public(document, stored_file)


def list_documents(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    skip: int,
    limit: int,
) -> tuple[Sequence[tuple[KnowledgeDocument, StoredFile]], int]:
    from app.modules.knowledge.service import get_knowledge_base

    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)

    condition = col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id
    count = session.exec(
        select(func.count()).select_from(KnowledgeDocument).where(condition)
    ).one()
    statement = (
        select(KnowledgeDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(condition)
        .order_by(col(KnowledgeDocument.created_at).desc())
        .offset(skip)
        .limit(limit)
    )

    return session.exec(statement).all(), count


def get_document_with_file(
    *, session: Session, document_id: uuid.UUID, for_update: bool = False
) -> tuple[KnowledgeDocument, StoredFile]:
    statement = (
        select(KnowledgeDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(col(KnowledgeDocument.id) == document_id)
    )

    if for_update:
        statement = statement.with_for_update()

    result = session.exec(statement).first()

    if result is None:
        raise KnowledgeDocumentNotFoundError

    return result


def get_preview(
    *, session: Session, document_id: uuid.UUID
) -> KnowledgeDocumentPreviewPublic:
    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if document.status != "ready":
        raise KnowledgeDocumentPreviewUnavailableError

    try:
        content = object_storage.read_object_bytes(document_preview_key(document_id))
        preview = content.decode("utf-8")
    except (FileUploadIncompleteError, UnicodeDecodeError) as error:
        raise KnowledgeDocumentPreviewUnavailableError from error

    return KnowledgeDocumentPreviewPublic(
        filename=stored_file.filename,
        content=preview,
    )


def get_original_file(*, session: Session, document_id: uuid.UUID) -> StoredFile:
    _, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if not stored_file.uploaded:
        raise FileUploadIncompleteError

    return stored_file


def retry_document(*, session: Session, document_id: uuid.UUID) -> None:
    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if document.status not in {"failed", "timed_out"} or not stored_file.uploaded:
        raise KnowledgeDocumentStateError

    document.status = "pending"
    document.error_message = None
    document.processing_started_at = None
    document.updated_at = get_datetime_utc()
    session.add(document)
    session.commit()


def delete_expired_uploads(*, session: Session, created_before: datetime) -> None:
    rows = session.exec(
        select(KnowledgeDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(
            col(KnowledgeDocument.status) == "pending",
            col(KnowledgeDocument.created_at) < created_before,
            col(StoredFile.uploaded).is_(False),
        )
        .with_for_update(skip_locked=True)
    ).all()

    if not rows:
        return

    _, object_keys = _delete_document_records(session, rows)
    session.commit()
    cleanup_objects(object_keys)


def delete_document(*, session: Session, document_id: uuid.UUID) -> None:
    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )
    document_ids, object_keys = _delete_document_records(
        session,
        [(document, stored_file)],
    )
    session.commit()

    cleanup_deleted_documents(document_ids, object_keys)


def delete_knowledge_base_documents(
    *, session: Session, knowledge_base_id: uuid.UUID
) -> tuple[list[uuid.UUID], list[str]]:
    rows = session.exec(
        select(KnowledgeDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id)
        .with_for_update()
    ).all()

    return _delete_document_records(session, rows)


def to_public(
    document: KnowledgeDocument, stored_file: StoredFile
) -> KnowledgeDocumentPublic:
    return KnowledgeDocumentPublic(
        id=document.id,
        knowledge_base_id=document.knowledge_base_id,
        filename=stored_file.filename,
        content_type=stored_file.content_type,
        size=stored_file.size,
        status=cast(KnowledgeDocumentStatus, document.status),
        error_message=document.error_message,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _validate_text_content(content: bytes, content_type: str) -> None:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise TextFileEncodingError from None

    if "\x00" in text:
        raise FileContentTypeMismatchError

    if content_type == "application/json":
        try:
            json.loads(text)
        except json.JSONDecodeError:
            raise FileContentTypeMismatchError from None


async def _delete_invalid_upload(
    session: Session,
    document_id: uuid.UUID,
) -> None:
    document, stored_file = get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    if stored_file.uploaded:
        return

    object_key = stored_file.object_key
    session.delete(document)
    session.flush()
    session.delete(stored_file)
    session.commit()
    await asyncio.to_thread(cleanup_objects, [object_key])


def cleanup_deleted_documents(
    document_ids: Sequence[uuid.UUID],
    object_keys: list[str],
) -> None:
    for document_id in document_ids:
        try:
            vector_store.delete_document(document_id)
        except Exception:
            logger.exception(
                EXTERNAL_CLEANUP_ERROR_LOG,
                extra={"document_id": str(document_id)},
            )

    cleanup_objects(object_keys)


def _delete_document_records(
    session: Session,
    rows: Sequence[tuple[KnowledgeDocument, StoredFile]],
) -> tuple[list[uuid.UUID], list[str]]:
    document_ids: list[uuid.UUID] = []
    object_keys: list[str] = []

    for document, stored_file in rows:
        document_ids.append(document.id)
        object_keys.extend(
            [
                stored_file.object_key,
                document_json_key(document.id),
                document_preview_key(document.id),
            ]
        )
        session.delete(document)

    session.flush()

    for _, stored_file in rows:
        session.delete(stored_file)

    return document_ids, object_keys
