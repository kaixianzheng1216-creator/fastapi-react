import asyncio
import logging
import uuid
from collections.abc import Sequence

from sqlmodel import Session, col, select

from app.modules.files import object_storage
from app.modules.files.constants import DOCUMENT_CONTENT_TYPES
from app.modules.files.exceptions import (
    FileSizeMismatchError,
    FileTypeNotAllowedError,
    FileUploadIncompleteError,
)
from app.modules.files.models import StoredFile
from app.modules.files.object_storage import UPLOAD_HEADERS
from app.modules.files.schemas import FileUploadRequest
from app.modules.files.service import cleanup_objects
from app.modules.knowledge import document_images, vector_store
from app.modules.knowledge.exceptions import (
    KnowledgeDocumentArtifactUnavailableError,
    KnowledgeDocumentNotFoundError,
    KnowledgeDocumentStateError,
)
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus
from app.modules.knowledge.schemas import (
    KnowledgeDocumentChunkPublic,
    KnowledgeDocumentPreviewPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentUploadPublic,
)
from app.modules.users.models import User

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
    folder_id: uuid.UUID | None,
    upload_request: FileUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    if upload_request.content_type not in DOCUMENT_CONTENT_TYPES:
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
        folder_id=folder_id,
        stored_file_id=file_id,
    )

    upload_url = object_storage.create_upload_url(object_key=object_key)

    session.add(stored_file)
    session.add(document)
    session.commit()

    return KnowledgeDocumentUploadPublic(
        id=document_id,
        upload_url=upload_url,
        upload_headers=UPLOAD_HEADERS,
    )


async def complete_upload(
    *, session: Session, document_id: uuid.UUID
) -> KnowledgeDocumentPublic:
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
            object_key = stored_file.object_key

            session.delete(document)
            session.flush()

            session.delete(stored_file)
            session.commit()

            await asyncio.to_thread(cleanup_objects, [object_key])

        raise FileSizeMismatchError

    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    if stored_file.uploaded:
        return to_public(document, stored_file)

    stored_file.uploaded = True

    session.commit()

    return to_public(document, stored_file)


async def create_webpage(
    *,
    session: Session,
    current_user: User,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    source_url: str,
    filename: str,
    content: bytes,
) -> KnowledgeDocumentPublic:
    """将网页 Markdown 保存为待处理文档。"""
    document_id = uuid.uuid4()

    file_id = uuid.uuid4()

    object_key = object_storage.create_object_key(
        owner_id=current_user.id,
        file_id=file_id,
    )

    await asyncio.to_thread(
        object_storage.write_object_content,
        object_key=object_key,
        content=content,
    )

    stored_file = StoredFile(
        id=file_id,
        owner_id=current_user.id,
        object_key=object_key,
        filename=filename,
        content_type="text/markdown",
        size=len(content),
        uploaded=True,
    )

    document = KnowledgeDocument(
        id=document_id,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        stored_file_id=file_id,
        source_url=source_url,
    )

    try:
        session.add(stored_file)

        session.add(document)

        session.commit()
    except Exception:
        session.rollback()

        await asyncio.to_thread(cleanup_objects, [object_key])

        raise

    return to_public(document, stored_file)


def get_document(
    *, session: Session, document_id: uuid.UUID
) -> KnowledgeDocumentPublic:
    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    return to_public(document, stored_file)


def get_preview(
    *, session: Session, document_id: uuid.UUID
) -> KnowledgeDocumentPreviewPublic:
    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if document.status != KnowledgeDocumentStatus.READY:
        raise KnowledgeDocumentArtifactUnavailableError

    try:
        content = object_storage.read_object_bytes(
            object_key=document_preview_key(document_id)
        )

        preview = document_images.resolve_markdown_image_urls(
            document_id=document_id,
            markdown=content.decode("utf-8"),
        )
    except (FileNotFoundError, UnicodeDecodeError) as error:
        raise KnowledgeDocumentArtifactUnavailableError from error

    return KnowledgeDocumentPreviewPublic(
        filename=stored_file.filename,
        content=preview,
    )


def list_document_chunks(
    *,
    session: Session,
    document_id: uuid.UUID,
    skip: int,
    limit: int,
) -> tuple[list[KnowledgeDocumentChunkPublic], int]:
    document, _ = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if document.status != KnowledgeDocumentStatus.READY:
        raise KnowledgeDocumentArtifactUnavailableError

    chunks, count = vector_store.list_document_chunks(
        document_id=document_id,
        skip=skip,
        limit=limit,
    )

    public_chunks: list[KnowledgeDocumentChunkPublic] = []

    for chunk in chunks:
        image_urls: list[str] = []

        for image_name in chunk.image_names:
            image_url = document_images.create_image_download_url(
                document_id,
                image_name,
            )
            image_urls.append(image_url)

        public_chunks.append(
            KnowledgeDocumentChunkPublic(
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                section_path=chunk.section_path,
                page_numbers=chunk.page_numbers,
                image_urls=image_urls,
            )
        )

    return public_chunks, count


def get_original_file(*, session: Session, document_id: uuid.UUID) -> StoredFile:
    _, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if not stored_file.uploaded:
        raise FileUploadIncompleteError

    return stored_file


def retry_document(*, session: Session, document_id: uuid.UUID) -> None:
    document, stored_file = _get_document_with_file(
        session=session,
        document_id=document_id,
    )

    if (
        document.status
        not in {
            KnowledgeDocumentStatus.FAILED,
            KnowledgeDocumentStatus.TIMED_OUT,
        }
        or not stored_file.uploaded
    ):
        raise KnowledgeDocumentStateError

    document.status = KnowledgeDocumentStatus.PENDING
    document.error_message = None

    session.commit()


def delete_document(*, session: Session, document_id: uuid.UUID) -> None:
    row = _get_document_with_file(
        session=session,
        document_id=document_id,
        for_update=True,
    )

    deleted_document_ids, object_keys = delete_document_records(session, [row])

    session.commit()

    cleanup_deleted_documents(deleted_document_ids, object_keys, delete_images=True)


def delete_knowledge_base_documents(
    *, session: Session, knowledge_base_id: uuid.UUID
) -> tuple[list[uuid.UUID], list[str]]:
    rows = session.exec(
        select(KnowledgeDocument, StoredFile)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id)
        .with_for_update()
    ).all()

    return delete_document_records(session, rows)


def delete_document_records(
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


def cleanup_deleted_documents(
    document_ids: Sequence[uuid.UUID],
    object_keys: list[str],
    *,
    delete_images: bool = False,
) -> None:
    for document_id in document_ids:
        try:
            vector_store.delete_document(document_id)
        except Exception:
            logger.exception(
                EXTERNAL_CLEANUP_ERROR_LOG,
                extra={"document_id": str(document_id)},
            )

    if delete_images:
        for document_id in document_ids:
            try:
                object_keys.extend(document_images.list_image_object_keys(document_id))
            except Exception:
                logger.exception(
                    EXTERNAL_CLEANUP_ERROR_LOG,
                    extra={"document_id": str(document_id)},
                )

    cleanup_objects(object_keys)


def to_public(
    document: KnowledgeDocument, stored_file: StoredFile
) -> KnowledgeDocumentPublic:
    return KnowledgeDocumentPublic(
        id=document.id,
        knowledge_base_id=document.knowledge_base_id,
        folder_id=document.folder_id,
        filename=stored_file.filename,
        content_type=stored_file.content_type,
        size=stored_file.size,
        uploaded=stored_file.uploaded,
        source_url=document.source_url,
        status=document.status,
        error_message=document.error_message,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def _get_document_with_file(
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
