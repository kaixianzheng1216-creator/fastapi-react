import base64
import logging
import uuid
from collections.abc import Iterator
from typing import Literal, cast

import httpx
from docling_core.transforms.chunker.base import BaseChunk
from docling_core.transforms.chunker.doc_chunk import DocMeta
from docling_core.transforms.chunker.hierarchical_chunker import (
    ChunkingDocSerializer,
    ChunkingSerializerProvider,
)
from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from docling_core.transforms.serializer.markdown import (
    MarkdownParams,
    MarkdownTableSerializer,
)
from docling_core.types.doc.base import ImageRefMode
from docling_core.types.doc.document import DoclingDocument
from docling_core.types.doc.items.group import GroupItem
from docling_core.types.doc.items.picture.picture import PictureItem
from docling_core.types.doc.items.table.table_data import TableData
from docling_core.types.doc.labels import DocItemLabel, GroupLabel
from openai import APITimeoutError, OpenAI
from pydantic import BaseModel, TypeAdapter, ValidationError
from sqlmodel import Session, col, select

from app.core.config import settings as app_settings
from app.db.session import engine
from app.db.timestamps import utc_now
from app.modules.files import object_storage
from app.modules.files.constants import (
    DOCUMENT_FORMAT_BY_CONTENT_TYPE,
    IMAGE_CONTENT_TYPES,
)
from app.modules.files.models import StoredFile
from app.modules.knowledge import document_images, embedding, vector_store
from app.modules.knowledge.config import settings as knowledge_settings
from app.modules.knowledge.documents import (
    cleanup_deleted_documents,
    document_json_key,
    document_preview_key,
    finish_processing_with_error,
)
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus

CHUNK_BATCH_SIZE = 64
DOCUMENT_PROCESSING_ERROR_LOG = "知识库文档处理失败"
DOCUMENT_CACHE_INVALID_LOG = "知识库文档解析缓存无效，将重新解析原文件"
DOCUMENT_PROCESSING_TIMEOUT_LOG = "知识库文档处理超时"
DOCUMENT_PROCESSING_TIMEOUT_MESSAGE = "文档处理超时"
DOCLING_INVALID_RESPONSE_MESSAGE = "Docling 返回内容无效"
IMAGE_DESCRIPTION_MODEL = "deepseek-flash"
DOCUMENT_JSON_ADAPTER = TypeAdapter(DoclingDocument)
logger = logging.getLogger(__name__)


class DocumentProcessingError(Exception):
    pass


class DocumentProcessingTimeoutError(DocumentProcessingError):
    pass


class _TableSerializerProvider(ChunkingSerializerProvider):
    def get_serializer(self, doc: DoclingDocument) -> ChunkingDocSerializer:
        return ChunkingDocSerializer(
            doc=doc,
            table_serializer=MarkdownTableSerializer(),
            params=MarkdownParams(compact_tables=True, image_placeholder=""),
        )


class _ParsedDocument(BaseModel):
    json_content: DoclingDocument | None = None


class _ConversionResponse(BaseModel):
    status: Literal["success", "partial_success", "skipped", "failure"]
    document: _ParsedDocument


def process_document(document_id: uuid.UUID) -> None:
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

        chunk_count = 0

        for chunk_records, embedding_texts in _create_chunk_batches(
            docling_document, content_type=stored_file.content_type
        ):
            vector_store.upsert_chunks(
                document_id=document_id,
                knowledge_base_id=document.knowledge_base_id,
                filename=stored_file.filename,
                chunks=chunk_records,
                vectors=embedding.embed_texts(embedding_texts),
            )

            chunk_count += len(chunk_records)

        if chunk_count == 0:
            raise DocumentProcessingError("文档没有可索引内容")

        _publish_document(
            document_id=document_id,
            markdown=docling_document.export_to_markdown(
                image_mode=ImageRefMode.REFERENCED,
                compact_tables=True,
            ),
        )
    except (
        DocumentProcessingTimeoutError,
        httpx.TimeoutException,
    ) as error:
        logger.warning(
            DOCUMENT_PROCESSING_TIMEOUT_LOG,
            extra={"document_id": str(document_id)},
            exc_info=error,
        )

        finish_processing_with_error(
            document_id=document_id,
            status=KnowledgeDocumentStatus.TIMED_OUT,
            error_message=DOCUMENT_PROCESSING_TIMEOUT_MESSAGE,
        )
    except Exception as error:
        logger.exception(
            DOCUMENT_PROCESSING_ERROR_LOG,
            extra={"document_id": str(document_id)},
        )

        error_message = f"{type(error).__name__}: {error}"

        finish_processing_with_error(
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

        return DoclingDocument.model_validate_json(document_json)
    except FileNotFoundError:
        pass
    except ValidationError:
        logger.warning(
            DOCUMENT_CACHE_INVALID_LOG,
            extra={"document_id": str(document_id)},
            exc_info=True,
        )

    if stored_file.content_type in IMAGE_CONTENT_TYPES:
        content = object_storage.read_object_bytes(object_key=stored_file.object_key)
        docling_document = _parse_image_document(stored_file, content)
    else:
        docling_document = _parse_with_docling(stored_file)

    document_images.store_embedded_images(
        document_id=document_id,
        document=docling_document,
    )

    object_storage.write_object_content(
        object_key=document_json_key(document_id),
        content=DOCUMENT_JSON_ADAPTER.dump_json(docling_document),
        content_type="application/json",
    )

    return docling_document


def _parse_image_document(
    stored_file: StoredFile,
    content: bytes,
) -> DoclingDocument:
    """使用视觉模型生成可检索的图片描述。"""
    image_url = (
        f"data:{stored_file.content_type};base64,{base64.b64encode(content).decode()}"
    )

    try:
        with OpenAI(
            api_key=knowledge_settings.NEWAPI_API_KEY.get_secret_value(),
            base_url=knowledge_settings.NEWAPI_BASE_URL,
        ) as client:
            response = client.chat.completions.create(
                model=IMAGE_DESCRIPTION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": knowledge_settings.IMAGE_DESCRIPTION_PROMPT,
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url},
                            },
                        ],
                    }
                ],
            )
    except APITimeoutError as error:
        raise DocumentProcessingTimeoutError from error

    description = response.choices[0].message.content

    if not description:
        raise DocumentProcessingError("视觉模型未生成图片描述")

    document = DoclingDocument(name=stored_file.filename)

    document.add_text(DocItemLabel.TEXT, description)

    return document


def _parse_with_docling(stored_file: StoredFile) -> DoclingDocument:
    """通过临时文件上传原文件，避免整份原文件常驻内存。"""
    document_format = DOCUMENT_FORMAT_BY_CONTENT_TYPE[stored_file.content_type]

    with (
        object_storage.download_to_temporary_file(stored_file.object_key) as content,
        httpx.Client(timeout=None) as client,
    ):
        response = client.post(
            f"{str(app_settings.DOCLING_BASE_URL).rstrip('/')}/v1/convert/file",
            data={
                "from_formats": document_format,
                "to_formats": ["json"],
                "image_export_mode": "embedded",
                "do_ocr": "false",
                "do_picture_description": "true",
                "picture_description_preset": "deepseek-flash",
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
        conversion = _ConversionResponse.model_validate_json(response.content)
    except ValueError as error:
        raise DocumentProcessingError(DOCLING_INVALID_RESPONSE_MESSAGE) from error

    if conversion.status != "success":
        raise DocumentProcessingError("Docling 无法完整解析该文档")

    docling_document = conversion.document.json_content

    if docling_document is None:
        raise DocumentProcessingError("Docling 未生成解析产物")

    return docling_document


def _chunk_table_records(
    document: DoclingDocument, chunker: HybridChunker
) -> Iterator[BaseChunk]:
    """逐条切分表格记录，超长记录由 Docling 拆分，不跨记录合并。"""
    for table_index, table in enumerate(document.tables, start=1):
        dataframe = table.export_to_dataframe(doc=document)

        columns: list[str] = []

        for column in dataframe.columns:
            columns.append(str(column))

        parent = None

        if table.parent:
            parent = table.parent.resolve(document)

        table_title = table.caption_text(document) or f"表格 {table_index}"

        for row_index, row in enumerate(
            dataframe.itertuples(index=False, name=None), start=1
        ):
            values = list(row)

            if not "".join(values).strip():
                continue

            record = DoclingDocument(name=document.name, origin=document.origin)

            if isinstance(parent, GroupItem) and parent.label == GroupLabel.SHEET:
                record.add_heading(parent.name, level=1)

            record.add_heading(table_title, level=2)
            record.add_heading(f"第 {row_index} 条记录", level=3)

            data = TableData(num_cols=len(columns))
            data.add_row(columns)

            for cell in data.table_cells:
                cell.column_header = True

            data.add_row(values)

            record_table = record.add_table(data=data)
            record_table.prov = list(table.prov)

            yield from chunker.chunk(record)


def _create_chunk_batches(
    document: DoclingDocument, *, content_type: str
) -> Iterator[tuple[list[vector_store.DocumentChunk], list[str]]]:
    """每批生成最多 64 个切片及一一对应的 Embedding 文本。"""
    chunker = HybridChunker(
        tokenizer=embedding.get_tokenizer(),
        serializer_provider=_TableSerializerProvider(),
        repeat_table_header=True,
    )

    chunks: list[vector_store.DocumentChunk] = []
    embedding_texts: list[str] = []

    if DOCUMENT_FORMAT_BY_CONTENT_TYPE.get(content_type) in {"csv", "xlsx"}:
        document_chunks = _chunk_table_records(document, chunker)
    else:
        document_chunks = chunker.chunk(document)

    for chunk_index, document_chunk in enumerate(document_chunks):
        metadata = cast(DocMeta, document_chunk.meta)

        page_numbers: set[int] = set()
        image_names: set[str] = set()

        for document_item in metadata.doc_items:
            for provenance in document_item.prov:
                page_numbers.add(provenance.page_no)

            if document_item.label != DocItemLabel.PICTURE:
                continue

            picture = document_item.get_ref().resolve(document)

            if not isinstance(picture, PictureItem):
                raise DocumentProcessingError("文档图片引用无效")

            if picture.image is None:
                continue

            image_names.add(
                document_images.image_name_from_reference(str(picture.image.uri))
            )

        chunks.append(
            vector_store.DocumentChunk(
                chunk_index=chunk_index,
                content=document_chunk.text,
                section_path=metadata.headings or [],
                page_numbers=sorted(page_numbers),
                image_names=sorted(image_names),
            )
        )

        embedding_texts.append(chunker.contextualize(document_chunk))

        if len(chunks) == CHUNK_BATCH_SIZE:
            yield chunks, embedding_texts

            chunks = []
            embedding_texts = []

    if chunks:
        yield chunks, embedding_texts


def _publish_document(
    *,
    document_id: uuid.UUID,
    markdown: str,
) -> None:
    """索引写入完成后，发布预览并标记为可用。"""
    with Session(engine) as session:
        document = session.get(KnowledgeDocument, document_id)

    if document is None:
        cleanup_deleted_documents(
            [document_id],
            [document_json_key(document_id), document_preview_key(document_id)],
            delete_images=True,
        )

        return

    object_storage.write_object_content(
        object_key=document_preview_key(document_id),
        content=markdown.encode("utf-8"),
        content_type="text/markdown; charset=utf-8",
    )

    with Session(engine) as session:
        document = session.get(
            KnowledgeDocument,
            document_id,
            with_for_update=True,
        )

        if document is not None:
            document.processing_finished_at = utc_now()
            document.status = KnowledgeDocumentStatus.READY
            document.error_message = None
            session.commit()

            return

    cleanup_deleted_documents(
        [document_id],
        [document_preview_key(document_id)],
        delete_images=True,
    )
