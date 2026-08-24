import json
import logging
import multiprocessing
import time
import uuid
from typing import Any, Literal, cast

import httpx
from docling_core.transforms.chunker.doc_chunk import DocMeta
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.types.doc.document import DoclingDocument
from docling_core.types.doc.labels import DocItemLabel
from pydantic import BaseModel, ValidationError
from sqlalchemy import update
from sqlmodel import Session, col, select

from app.core.config import settings as app_settings
from app.db.session import engine
from app.modules.files import object_storage
from app.modules.files.constants import DOCUMENT_FORMAT_BY_CONTENT_TYPE
from app.modules.files.models import StoredFile
from app.modules.files.service import cleanup_objects
from app.modules.knowledge import embedding, vector_store
from app.modules.knowledge.documents import (
    cleanup_deleted_documents,
    document_json_key,
    document_preview_key,
)
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus

POLL_INTERVAL_SECONDS = 2
PROCESSING_TIMEOUT_SECONDS = 10 * 60
DOCUMENT_PROCESSING_TIMEOUT_LOG = "知识库文档处理超时"
DOCUMENT_PROCESSING_TIMEOUT_MESSAGE = "文档处理超时"
DOCLING_INVALID_RESPONSE_MESSAGE = "Docling 返回内容无效"

logger = logging.getLogger(__name__)


class DocumentProcessingError(Exception):
    pass


class DocumentProcessingTimeoutError(DocumentProcessingError):
    pass


class _ParsedDocument(BaseModel):
    json_content: dict[str, Any] | None = None


class _ConversionResponse(BaseModel):
    status: Literal["success", "partial_success", "skipped", "failure"]
    document: _ParsedDocument


def run() -> None:
    """运行知识库文档处理循环。"""
    vector_store.ensure_collection()

    _fail_processing_documents_after_restart()

    while True:
        with Session(engine) as session:
            claimed_document = _claim_document(session)

        if claimed_document is None:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        _process_document_with_timeout(claimed_document)


def _claim_document(session: Session) -> uuid.UUID | None:
    """领取一个等待处理的已上传文档。"""
    statement = (
        select(KnowledgeDocument)
        .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
        .where(
            col(KnowledgeDocument.status) == KnowledgeDocumentStatus.PENDING,
            col(StoredFile.uploaded).is_(True),
        )
        .order_by(col(KnowledgeDocument.created_at))
        .with_for_update()
        .limit(1)
    )

    document = session.exec(statement).first()

    if document is None:
        return None

    document.status = KnowledgeDocumentStatus.PROCESSING
    session.commit()

    return document.id


def _process_document_with_timeout(document_id: uuid.UUID) -> None:
    """在独立子进程中限时处理文档。"""
    process = multiprocessing.get_context("spawn").Process(
        target=_process_document,
        args=(document_id,),
    )
    process.start()
    process.join(PROCESSING_TIMEOUT_SECONDS)

    timed_out = process.is_alive()

    if timed_out:
        process.kill()
        process.join()

    exit_code = process.exitcode
    process.close()

    if timed_out:
        logger.warning(
            DOCUMENT_PROCESSING_TIMEOUT_LOG,
            extra={"document_id": str(document_id)},
        )

        _finish_with_error(
            document_id=document_id,
            status=KnowledgeDocumentStatus.TIMED_OUT,
            error_message=DOCUMENT_PROCESSING_TIMEOUT_MESSAGE,
        )

        return

    if exit_code == 0:
        return

    logger.error(
        "知识库文档处理进程异常退出",
        extra={"document_id": str(document_id), "exit_code": exit_code},
    )

    _finish_with_error(
        document_id=document_id,
        status=KnowledgeDocumentStatus.FAILED,
        error_message="文档处理失败，请重试",
    )


def _process_document(document_id: uuid.UUID) -> None:
    """执行文档解析、切片、向量化和发布。"""
    try:
        result = _get_processing_document(document_id)

        if result is None:
            return

        document, stored_file = result

        vector_store.delete_document(document_id)

        docling_document = _load_or_parse_document(
            document_id=document_id,
            stored_file=stored_file,
        )

        chunk_records, embedding_texts = _create_chunks(docling_document)

        if not chunk_records:
            raise DocumentProcessingError("文档没有可索引内容")

        vectors = embedding.embed_texts(embedding_texts)

        _publish_document(
            document_id=document_id,
            knowledge_base_id=document.knowledge_base_id,
            filename=stored_file.filename,
            chunks=chunk_records,
            vectors=vectors,
            markdown=docling_document.export_to_markdown(),
        )
    except (
        DocumentProcessingTimeoutError,
        embedding.EmbeddingTimeoutError,
    ) as error:
        logger.warning(
            DOCUMENT_PROCESSING_TIMEOUT_LOG,
            extra={"document_id": str(document_id)},
            exc_info=error,
        )

        _finish_with_error(
            document_id=document_id,
            status=KnowledgeDocumentStatus.TIMED_OUT,
            error_message=DOCUMENT_PROCESSING_TIMEOUT_MESSAGE,
        )
    except Exception as error:
        logger.exception(
            "知识库文档处理失败",
            extra={"document_id": str(document_id)},
        )

        if isinstance(error, DocumentProcessingError):
            error_message = str(error)
        else:
            error_message = "文档处理失败，请重试"

        _finish_with_error(
            document_id=document_id,
            status=KnowledgeDocumentStatus.FAILED,
            error_message=error_message,
        )


def _get_processing_document(
    document_id: uuid.UUID,
) -> tuple[KnowledgeDocument, StoredFile] | None:
    """获取本次处理任务对应的文档和原文件。"""
    with Session(engine) as session:
        result = session.exec(
            select(KnowledgeDocument, StoredFile)
            .join(StoredFile, col(StoredFile.id) == KnowledgeDocument.stored_file_id)
            .where(
                col(KnowledgeDocument.id) == document_id,
                col(KnowledgeDocument.status) == KnowledgeDocumentStatus.PROCESSING,
            )
        ).first()

        if result is None:
            return None

        return result


def _load_or_parse_document(
    *, document_id: uuid.UUID, stored_file: StoredFile
) -> DoclingDocument:
    """优先读取解析缓存，否则解析原文件。"""
    try:
        document_json = object_storage.read_object_bytes(
            object_key=document_json_key(document_id)
        )

        docling_document = DoclingDocument.model_validate_json(document_json)

        return docling_document
    except FileNotFoundError:
        pass
    except ValidationError:
        logger.warning(
            "知识库文档解析缓存无效，将重新解析原文件",
            extra={"document_id": str(document_id)},
            exc_info=True,
        )

    content = object_storage.read_object_bytes(object_key=stored_file.object_key)

    if stored_file.content_type == "application/json":
        docling_document = _parse_json_document(stored_file, content)
    else:
        docling_document = _parse_with_docling(stored_file, content)

    object_storage.write_object_content(
        object_key=document_json_key(document_id),
        content=docling_document.model_dump_json().encode("utf-8"),
    )

    return docling_document


def _parse_json_document(
    stored_file: StoredFile,
    content: bytes,
) -> DoclingDocument:
    """将 JSON 原文件转换为 Docling 文档。"""
    try:
        parsed_json = json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DocumentProcessingError("JSON 文件格式无效") from error

    document = DoclingDocument(name=stored_file.filename)

    document.add_text(
        DocItemLabel.TEXT,
        json.dumps(parsed_json, ensure_ascii=False, indent=4),
    )

    return document


def _parse_with_docling(stored_file: StoredFile, content: bytes) -> DoclingDocument:
    """调用 Docling 解析原文件。"""
    document_format = DOCUMENT_FORMAT_BY_CONTENT_TYPE[stored_file.content_type]

    with httpx.Client(timeout=None) as client:
        response = client.post(
            f"{str(app_settings.DOCLING_BASE_URL).rstrip('/')}/v1/convert/file",
            data={
                "from_formats": document_format,
                "to_formats": ["json"],
                "image_export_mode": "placeholder",
            },
            files={
                "files": (
                    stored_file.filename,
                    content,
                    stored_file.content_type,
                )
            },
        )

    if response.status_code == httpx.codes.GATEWAY_TIMEOUT:
        raise DocumentProcessingTimeoutError

    response.raise_for_status()

    try:
        conversion = _ConversionResponse.model_validate(response.json())
    except ValueError as error:
        raise DocumentProcessingError(DOCLING_INVALID_RESPONSE_MESSAGE) from error

    if conversion.status != "success":
        raise DocumentProcessingError("Docling 无法完整解析该文档")

    json_content = conversion.document.json_content

    if json_content is None:
        raise DocumentProcessingError("Docling 未生成解析产物")

    try:
        docling_document = DoclingDocument.model_validate(json_content)
    except ValidationError as error:
        raise DocumentProcessingError(DOCLING_INVALID_RESPONSE_MESSAGE) from error

    return docling_document


def _create_chunks(
    document: DoclingDocument,
) -> tuple[list[dict[str, Any]], list[str]]:
    """创建检索切片及与其索引一一对应的 Embedding 文本。"""
    chunker = HybridChunker(tokenizer=embedding.get_tokenizer())

    chunk_records: list[dict[str, Any]] = []
    embedding_texts: list[str] = []

    for document_chunk in chunker.chunk(document):
        metadata = cast(DocMeta, document_chunk.meta)

        page_numbers: set[int] = set()

        for document_item in metadata.doc_items:
            for provenance in document_item.prov:
                page_numbers.add(provenance.page_no)

        chunk_records.append(
            {
                "content": document_chunk.text,
                "section_path": metadata.headings or [],
                "page_numbers": sorted(page_numbers),
            }
        )

        embedding_texts.append(chunker.contextualize(document_chunk))

    return chunk_records, embedding_texts


def _publish_document(
    *,
    document_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    filename: str,
    chunks: list[dict[str, Any]],
    vectors: list[list[float]],
    markdown: str,
) -> None:
    """发布文档索引和预览并标记为可用。"""
    with Session(engine) as session:
        document = session.get(KnowledgeDocument, document_id)

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

    with Session(engine) as session:
        document = session.get(
            KnowledgeDocument,
            document_id,
            with_for_update=True,
        )

        if document is not None:
            document.status = KnowledgeDocumentStatus.READY
            document.error_message = None
            session.commit()

            return

    cleanup_deleted_documents(
        [document_id],
        [document_preview_key(document_id)],
    )


def _finish_with_error(
    *,
    document_id: uuid.UUID,
    status: KnowledgeDocumentStatus,
    error_message: str,
) -> None:
    """结束失败的处理任务并清理无效产物。"""
    object_keys = [document_preview_key(document_id)]

    with Session(engine) as session:
        document = session.get(
            KnowledgeDocument,
            document_id,
            with_for_update=True,
        )

        if document is None:
            object_keys.append(document_json_key(document_id))
        elif document.status != KnowledgeDocumentStatus.PROCESSING:
            return
        else:
            document.status = status
            document.error_message = error_message
            session.commit()

    cleanup_deleted_documents([document_id], object_keys)


def _fail_processing_documents_after_restart() -> None:
    """将 Worker 重启前中断的任务标记为失败。"""
    with Session(engine) as session:
        rows = session.exec(
            update(KnowledgeDocument)
            .where(col(KnowledgeDocument.status) == KnowledgeDocumentStatus.PROCESSING)
            .values(
                status=KnowledgeDocumentStatus.FAILED,
                error_message="Worker 重启中断了文档处理",
            )
            .returning(col(KnowledgeDocument.id))
        ).all()

        document_ids = [cast(uuid.UUID, row[0]) for row in rows]
        session.commit()

    cleanup_deleted_documents(
        document_ids,
        [document_preview_key(document_id) for document_id in document_ids],
    )


if __name__ == "__main__":
    run()
