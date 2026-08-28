import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from functools import cache

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import ApiException

from app.modules.knowledge.config import settings

COLLECTION_NAME = settings.QDRANT_COLLECTION_NAME
VECTOR_NAME = "dense"
VECTOR_DISTANCE = models.Distance.COSINE
UPSERT_BATCH_SIZE = 64

COLLECTION_METADATA = {
    "embedding_model": settings.EMBEDDING_MODEL,
}


class VectorStoreUnavailableError(Exception):
    pass


@dataclass
class DocumentChunk:
    chunk_index: int
    content: str
    section_path: list[str]
    page_numbers: list[int]
    image_names: list[str]


@dataclass
class SearchResult:
    document_id: uuid.UUID
    chunk_index: int
    filename: str
    content: str
    section_path: list[str]
    page_numbers: list[int]
    image_names: list[str]
    score: float


def ensure_collection() -> None:
    """创建并校验知识库 Collection。"""
    client = _get_client()

    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                VECTOR_NAME: models.VectorParams(
                    size=settings.EMBEDDING_DIMENSIONS,
                    distance=VECTOR_DISTANCE,
                )
            },
            metadata=COLLECTION_METADATA,
        )

    collection = client.get_collection(COLLECTION_NAME)
    vectors = collection.config.params.vectors

    vector_config = vectors.get(VECTOR_NAME) if isinstance(vectors, dict) else None

    if (
        vector_config is None
        or vector_config.size != settings.EMBEDDING_DIMENSIONS
        or vector_config.distance != VECTOR_DISTANCE
    ):
        raise RuntimeError("Qdrant Collection 向量配置不匹配")

    metadata = collection.config.metadata

    if metadata is None or any(
        metadata.get(key) != value for key, value in COLLECTION_METADATA.items()
    ):
        raise RuntimeError("Qdrant Collection 索引模型配置不匹配")

    payload_schema = collection.payload_schema

    knowledge_base_index = payload_schema.get("knowledge_base_id")

    if knowledge_base_index is None:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="knowledge_base_id",
            field_schema=models.KeywordIndexParams(
                type=models.KeywordIndexType.KEYWORD,
                is_tenant=True,
            ),
            wait=True,
        )
    elif (
        knowledge_base_index.data_type != models.PayloadSchemaType.KEYWORD
        or not isinstance(knowledge_base_index.params, models.KeywordIndexParams)
        or knowledge_base_index.params.is_tenant is not True
    ):
        raise RuntimeError("Qdrant knowledge_base_id 索引配置不匹配")

    document_index = payload_schema.get("document_id")

    if document_index is None:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="document_id",
            field_schema=models.PayloadSchemaType.UUID,
            wait=True,
        )
    elif document_index.data_type != models.PayloadSchemaType.UUID:
        raise RuntimeError("Qdrant document_id 索引配置不匹配")

    chunk_index = payload_schema.get("chunk_index")

    if chunk_index is None:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="chunk_index",
            field_schema=models.PayloadSchemaType.INTEGER,
            wait=True,
        )
    elif chunk_index.data_type != models.PayloadSchemaType.INTEGER:
        raise RuntimeError("Qdrant chunk_index 索引配置不匹配")


def upsert_chunks(
    *,
    document_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    filename: str,
    chunks: Sequence[DocumentChunk],
    vectors: Sequence[list[float]],
) -> None:
    """将文档切片及其向量写入 Qdrant。"""
    if len(chunks) != len(vectors):
        raise ValueError("切片与向量数量不一致")

    client = _get_client()

    for batch_start in range(0, len(chunks), UPSERT_BATCH_SIZE):
        batch_end = min(batch_start + UPSERT_BATCH_SIZE, len(chunks))

        points: list[models.PointStruct] = []

        for index in range(batch_start, batch_end):
            chunk = chunks[index]

            points.append(
                models.PointStruct(
                    id=str(uuid.uuid5(document_id, str(chunk.chunk_index))),
                    vector={VECTOR_NAME: vectors[index]},
                    payload={
                        "knowledge_base_id": str(knowledge_base_id),
                        "document_id": str(document_id),
                        "filename": filename,
                        "chunk_index": chunk.chunk_index,
                        "content": chunk.content,
                        "section_path": chunk.section_path,
                        "page_numbers": chunk.page_numbers,
                        "image_names": chunk.image_names,
                    },
                )
            )

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
            wait=True,
        )


def list_document_chunks(
    *,
    document_id: uuid.UUID,
    skip: int,
    limit: int,
) -> tuple[list[DocumentChunk], int]:
    """分页获取指定文档的切片。"""
    client = _get_client()

    document_filter = models.FieldCondition(
        key="document_id",
        match=models.MatchValue(value=str(document_id)),
    )

    total = client.count(
        collection_name=COLLECTION_NAME,
        count_filter=models.Filter(must=[document_filter]),
        exact=True,
    ).count

    records, _ = client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=models.Filter(
            must=[
                document_filter,
                models.FieldCondition(
                    key="chunk_index",
                    range=models.Range(gte=skip, lt=skip + limit),
                ),
            ]
        ),
        limit=limit,
    )

    chunks: list[DocumentChunk] = []

    for record in records:
        payload = record.payload

        if payload is None:
            raise RuntimeError("Qdrant 切片缺少 Payload")

        chunks.append(
            DocumentChunk(
                chunk_index=int(payload["chunk_index"]),
                content=str(payload["content"]),
                section_path=[str(value) for value in payload["section_path"]],
                page_numbers=[int(value) for value in payload["page_numbers"]],
                image_names=[str(value) for value in payload.get("image_names", [])],
            )
        )

    chunks.sort(key=lambda chunk: chunk.chunk_index)

    return chunks, total


def search(
    *,
    vector: list[float],
    knowledge_base_id: uuid.UUID,
    document_ids: Sequence[uuid.UUID],
    limit: int,
) -> list[SearchResult]:
    """在指定知识库的可用文档中检索相关切片。"""
    if not document_ids:
        return []

    client = _get_client()

    search_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="knowledge_base_id",
                match=models.MatchValue(value=str(knowledge_base_id)),
            ),
            models.FieldCondition(
                key="document_id",
                match=models.MatchAny(any=[str(value) for value in document_ids]),
            ),
        ]
    )

    try:
        response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            using=VECTOR_NAME,
            query_filter=search_filter,
            limit=limit,
            with_payload=True,
        )
    except ApiException as error:
        raise VectorStoreUnavailableError from error

    results: list[SearchResult] = []

    for point in response.points:
        payload = point.payload

        if payload is None:
            raise RuntimeError("Qdrant 检索结果缺少 Payload")

        results.append(
            SearchResult(
                document_id=uuid.UUID(str(payload["document_id"])),
                chunk_index=int(payload["chunk_index"]),
                filename=str(payload["filename"]),
                content=str(payload["content"]),
                section_path=[str(value) for value in payload.get("section_path", [])],
                page_numbers=[int(value) for value in payload.get("page_numbers", [])],
                image_names=[str(value) for value in payload.get("image_names", [])],
                score=point.score,
            )
        )

    return results


def delete_document(document_id: uuid.UUID) -> None:
    """删除指定文档的全部切片。"""
    client = _get_client()

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=str(document_id)),
                    )
                ]
            )
        ),
        wait=True,
    )


@cache
def _get_client() -> QdrantClient:
    """获取复用的 Qdrant 客户端。"""

    return QdrantClient(url=settings.QDRANT_URL)
