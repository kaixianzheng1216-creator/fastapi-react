import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, cast

import httpx
from docling_core.transforms.chunker.doc_chunk import DocMeta
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.types.doc.document import DoclingDocument
from docling_core.types.doc.labels import DocItemLabel
from pydantic import BaseModel, ValidationError
from sqlalchemy import update
from sqlmodel import Session, col, select

from app.core.config import settings as app_settings
from app.db import models as database_models  # noqa: F401
from app.db.session import engine
from app.modules.files import object_storage
from app.modules.files.constants import DOCUMENT_FORMAT_BY_CONTENT_TYPE
from app.modules.files.exceptions import FileUploadIncompleteError
from app.modules.files.models import StoredFile
from app.modules.files.service import cleanup_objects
from app.modules.knowledge import embedding, vector_store
from app.modules.knowledge.documents import (
    cleanup_deleted_documents,
    delete_expired_uploads,
    document_json_key,
    document_preview_key,
)
from app.modules.knowledge.models import KnowledgeDocument, get_datetime_utc

POLL_INTERVAL_SECONDS = 2
STALE_SCAN_INTERVAL_SECONDS = 60
PROCESSING_TIMEOUT = timedelta(minutes=30)
INCOMPLETE_UPLOAD_RETENTION = timedelta(hours=24)
DOCLING_TIMEOUT_SECONDS = 30 * 60
MAX_PAGE_COUNT = 1000
WORKER_ERROR_LOG = "知识库文档处理失败"

logger = logging.getLogger(__name__)
chunker = HybridChunker(
    tokenizer=embedding.tokenizer,
    merge_peers=True,
    omit_header_on_overflow=True,
)


class DocumentProcessingError(Exception):
    pass


class _ParsedDocument(BaseModel):
    md_content: str | None = None
    json_content: dict[str, Any] | str | None = None


class _ConversionResponse(BaseModel):
    status: str
    document: _ParsedDocument


def run() -> None:
    vector_store.ensure_collection()
    next_stale_scan = 0.0

    while True:
        if time.monotonic() >= next_stale_scan:
            _cleanup_stale_documents()
            next_stale_scan = time.monotonic() + STALE_SCAN_INTERVAL_SECONDS

        with Session(engine) as session:
            claimed_document = _claim_document(session)

        if claimed_document is None:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        _process_document(*claimed_document)


def _claim_document(session: Session) -> tuple[uuid.UUID, datetime] | None:
    statement = (
        select(KnowledgeDocument)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(
            col(KnowledgeDocument.status) == "pending",
            col(StoredFile.uploaded).is_(True),
        )
        .order_by(col(KnowledgeDocument.created_at))
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    document = session.exec(statement).first()

    if document is None:
        return None

    now = get_datetime_utc()
    document.status = "processing"
    document.processing_started_at = now
    document.updated_at = now
    session.add(document)
    session.commit()

    return document.id, now


def _process_document(
    document_id: uuid.UUID,
    processing_started_at: datetime,
) -> None:
    try:
        with Session(engine) as session:
            statement = (
                select(KnowledgeDocument, StoredFile)
                .join(
                    StoredFile,
                    col(StoredFile.id) == KnowledgeDocument.stored_file_id,
                )
                .where(
                    col(KnowledgeDocument.id) == document_id,
                    col(KnowledgeDocument.status) == "processing",
                    col(KnowledgeDocument.processing_started_at)
                    == processing_started_at,
                )
            )
            result = session.exec(statement).first()

            if result is None:
                return

            document, stored_file = result

        vector_store.delete_document(document_id)
        docling_document, markdown = _load_or_parse_document(
            document_id=document_id,
            stored_file=stored_file,
        )

        if len(docling_document.pages) > MAX_PAGE_COUNT:
            raise DocumentProcessingError("文档不能超过 1,000 页")

        chunks, embedding_inputs = _create_chunks(docling_document)

        if not chunks:
            raise DocumentProcessingError("文档没有可索引内容")

        vectors = embedding.embed_texts(embedding_inputs)
        _publish_document(
            document_id=document_id,
            processing_started_at=processing_started_at,
            knowledge_base_id=document.knowledge_base_id,
            filename=stored_file.filename,
            chunks=chunks,
            vectors=vectors,
            markdown=markdown,
        )
    except httpx.TimeoutException, embedding.EmbeddingTimeoutError:
        _finish_with_error(
            document_id=document_id,
            processing_started_at=processing_started_at,
            status="timed_out",
            error_message="文档处理超时",
        )
    except Exception as error:
        logger.exception(WORKER_ERROR_LOG, extra={"document_id": str(document_id)})
        _finish_with_error(
            document_id=document_id,
            processing_started_at=processing_started_at,
            status="failed",
            error_message=_error_message(error),
        )


def _load_or_parse_document(
    *, document_id: uuid.UUID, stored_file: StoredFile
) -> tuple[DoclingDocument, str]:
    try:
        document_json = object_storage.read_object_bytes(document_json_key(document_id))
        docling_document = DoclingDocument.model_validate_json(document_json)

        return docling_document, docling_document.export_to_markdown()
    except FileUploadIncompleteError:
        pass

    content = object_storage.read_object_bytes(stored_file.object_key)

    if stored_file.content_type == "application/json":
        parsed_json = json.loads(content.decode("utf-8-sig"))
        docling_document = DoclingDocument(name=stored_file.filename)
        docling_document.add_text(
            DocItemLabel.TEXT,
            json.dumps(parsed_json, ensure_ascii=False, indent=2),
        )
        markdown = docling_document.export_to_markdown()
    else:
        docling_document, markdown = _parse_with_docling(stored_file, content)

    object_storage.write_object_content(
        object_key=document_json_key(document_id),
        content=docling_document.model_dump_json().encode("utf-8"),
    )

    return docling_document, markdown


def _parse_with_docling(
    stored_file: StoredFile, content: bytes
) -> tuple[DoclingDocument, str]:
    document_format = DOCUMENT_FORMAT_BY_CONTENT_TYPE.get(stored_file.content_type)

    if document_format is None:
        document_format = "csv" if stored_file.content_type == "text/csv" else "md"

    with httpx.Client(timeout=DOCLING_TIMEOUT_SECONDS) as client:
        response = client.post(
            f"{str(app_settings.DOCLING_BASE_URL).rstrip('/')}/v1/convert/file",
            data={
                "from_formats": document_format,
                "to_formats": ["json", "md"],
                "image_export_mode": "placeholder",
            },
            files={"files": (stored_file.filename, content)},
        )

    response.raise_for_status()

    try:
        conversion = _ConversionResponse.model_validate(response.json())
    except (ValueError, ValidationError) as error:
        raise DocumentProcessingError("Docling 返回内容无效") from error

    if conversion.status not in {"success", "partial_success"}:
        raise DocumentProcessingError("Docling 无法解析该文档")

    json_content = conversion.document.json_content
    markdown = conversion.document.md_content

    if json_content is None or not markdown:
        raise DocumentProcessingError("Docling 未生成完整解析产物")

    if isinstance(json_content, str):
        docling_document = DoclingDocument.model_validate_json(json_content)
    else:
        docling_document = DoclingDocument.model_validate(json_content)

    return docling_document, markdown


def _create_chunks(
    document: DoclingDocument,
) -> tuple[list[dict[str, Any]], list[str]]:
    chunks: list[dict[str, Any]] = []
    embedding_inputs: list[str] = []

    for chunk in chunker.chunk(document):
        text = chunk.text.strip()

        if not text:
            continue

        meta = cast(DocMeta, chunk.meta)
        page_numbers = sorted(
            {provenance.page_no for item in meta.doc_items for provenance in item.prov}
        )
        chunks.append(
            {
                "content": text,
                "section_path": meta.headings or [],
                "page_numbers": page_numbers,
            }
        )
        embedding_input = chunker.contextualize(chunk)
        embedding_inputs.append(embedding_input)

    return chunks, embedding_inputs


def _publish_document(
    *,
    document_id: uuid.UUID,
    processing_started_at: datetime,
    knowledge_base_id: uuid.UUID,
    filename: str,
    chunks: list[dict[str, Any]],
    vectors: list[list[float]],
    markdown: str,
) -> None:
    with Session(engine) as session:
        document = session.get(KnowledgeDocument, document_id)

        if document is not None and (
            document.status != "processing"
            or document.processing_started_at != processing_started_at
        ):
            return

    if document is None:
        cleanup_objects(
            [document_json_key(document_id), document_preview_key(document_id)]
        )

        return

    vector_store.upsert_chunks(
        document_id=document_id,
        knowledge_base_id=knowledge_base_id,
        filename=filename,
        chunks=chunks,
        vectors=vectors,
    )
    object_storage.write_object_content(
        object_key=document_preview_key(document_id),
        content=markdown.encode("utf-8"),
    )

    cleanup_published_resources = False

    with Session(engine) as session:
        document = session.exec(
            select(KnowledgeDocument)
            .where(col(KnowledgeDocument.id) == document_id)
            .with_for_update()
        ).first()

        if document is not None and (
            document.status == "processing"
            and document.processing_started_at == processing_started_at
        ):
            document.status = "ready"
            document.error_message = None
            document.processing_started_at = None
            document.updated_at = get_datetime_utc()
            session.add(document)
            session.commit()
        elif document is None or document.status in {"failed", "timed_out"}:
            cleanup_published_resources = True

    if cleanup_published_resources:
        cleanup_deleted_documents(
            [document_id],
            [document_preview_key(document_id)],
        )


def _finish_with_error(
    *,
    document_id: uuid.UUID,
    processing_started_at: datetime,
    status: str,
    error_message: str,
) -> None:
    cleanup_keys: list[str] | None = None

    with Session(engine) as session:
        document = session.exec(
            select(KnowledgeDocument)
            .where(col(KnowledgeDocument.id) == document_id)
            .with_for_update()
        ).first()

        if document is None:
            cleanup_keys = [
                document_json_key(document_id),
                document_preview_key(document_id),
            ]
        elif (
            document.status != "processing"
            or document.processing_started_at != processing_started_at
        ):
            return
        else:
            document.status = status
            document.error_message = error_message
            document.processing_started_at = None
            document.updated_at = get_datetime_utc()
            session.add(document)
            session.commit()
            cleanup_keys = [document_preview_key(document_id)]

    if cleanup_keys is not None:
        cleanup_deleted_documents([document_id], cleanup_keys)


def _cleanup_stale_documents() -> None:
    now = get_datetime_utc()

    with Session(engine) as session:
        delete_expired_uploads(
            session=session,
            created_before=now - INCOMPLETE_UPLOAD_RETENTION,
        )
        rows = session.exec(
            update(KnowledgeDocument)
            .where(
                col(KnowledgeDocument.status) == "processing",
                col(KnowledgeDocument.processing_started_at) < now - PROCESSING_TIMEOUT,
            )
            .values(
                status="timed_out",
                error_message="文档处理超过 30 分钟",
                processing_started_at=None,
                updated_at=now,
            )
            .returning(col(KnowledgeDocument.id))
        ).all()
        document_ids = [cast(uuid.UUID, row[0]) for row in rows]
        session.commit()

    cleanup_deleted_documents(
        document_ids,
        [document_preview_key(document_id) for document_id in document_ids],
    )


def _error_message(error: Exception) -> str:
    if isinstance(error, DocumentProcessingError):
        return str(error)

    if isinstance(error, embedding.EmbeddingInputTooLongError):
        return str(error)

    if isinstance(error, httpx.HTTPStatusError) and error.response.status_code == 413:
        return "文档超过解析服务限制"

    return "文档处理失败，请重试"


if __name__ == "__main__":
    run()
