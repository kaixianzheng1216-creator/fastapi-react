import uuid
from collections.abc import Sequence
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.modules.knowledge.config import settings
from app.modules.knowledge.schemas import KnowledgeSearchResultPublic

COLLECTION_NAME = "knowledge_chunks_v1"
VECTOR_NAME = "dense"
VECTOR_SIZE = 1024

client = QdrantClient(url=settings.QDRANT_URL)


def ensure_collection() -> None:
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config={
                VECTOR_NAME: models.VectorParams(
                    size=VECTOR_SIZE,
                    distance=models.Distance.COSINE,
                )
            },
        )

    collection = client.get_collection(COLLECTION_NAME)
    vectors = collection.config.params.vectors

    if not isinstance(vectors, dict) or vectors[VECTOR_NAME].size != VECTOR_SIZE:
        raise RuntimeError("Qdrant Collection 向量配置不匹配")

    payload_schema = collection.payload_schema

    if "knowledge_base_id" not in payload_schema:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="knowledge_base_id",
            field_schema=models.KeywordIndexParams(
                type=models.KeywordIndexType.KEYWORD,
                is_tenant=True,
            ),
            wait=True,
        )

    if "document_id" not in payload_schema:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="document_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
            wait=True,
        )


def delete_document(document_id: uuid.UUID) -> None:
    ensure_collection()
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


def upsert_chunks(
    *,
    document_id: uuid.UUID,
    knowledge_base_id: uuid.UUID,
    filename: str,
    chunks: Sequence[dict[str, Any]],
    vectors: Sequence[list[float]],
) -> None:
    ensure_collection()

    for start in range(0, len(chunks), 64):
        points: list[models.PointStruct] = []

        for index, (chunk, vector) in enumerate(
            zip(chunks[start : start + 64], vectors[start : start + 64], strict=True),
            start=start,
        ):
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid5(document_id, str(index))),
                    vector={VECTOR_NAME: vector},
                    payload={
                        "knowledge_base_id": str(knowledge_base_id),
                        "document_id": str(document_id),
                        "filename": filename,
                        **chunk,
                    },
                )
            )

        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
            wait=True,
        )


def search(
    *,
    vector: list[float],
    knowledge_base_ids: Sequence[uuid.UUID],
    document_ids: Sequence[uuid.UUID],
    limit: int = 6,
) -> list[KnowledgeSearchResultPublic]:
    if not knowledge_base_ids or not document_ids:
        return []

    ensure_collection()
    response = client.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        using=VECTOR_NAME,
        query_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="knowledge_base_id",
                    match=models.MatchAny(
                        any=[str(value) for value in knowledge_base_ids]
                    ),
                ),
                models.FieldCondition(
                    key="document_id",
                    match=models.MatchAny(any=[str(value) for value in document_ids]),
                ),
            ]
        ),
        limit=limit,
        with_payload=True,
    )

    results: list[KnowledgeSearchResultPublic] = []

    for point in response.points:
        payload = point.payload or {}
        results.append(
            KnowledgeSearchResultPublic(
                document_id=uuid.UUID(str(payload["document_id"])),
                filename=str(payload["filename"]),
                content=str(payload["content"]),
                section_path=[str(value) for value in payload.get("section_path", [])],
                page_numbers=[int(value) for value in payload.get("page_numbers", [])],
                score=point.score,
            )
        )

    return results
