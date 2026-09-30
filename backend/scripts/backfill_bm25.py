import logging

from qdrant_client import QdrantClient
from qdrant_client.conversions.common_types import PointId
from qdrant_client.http import models

from app.modules.knowledge import bm25, vector_store
from app.modules.knowledge.config import settings

logger = logging.getLogger(__name__)
SOURCE_COLLECTION_NAME = settings.QDRANT_COLLECTION_NAME


def main() -> None:
    """复制旧切片到混合检索 Collection；保留旧数据，跳过已迁移的切片。"""
    vector_store.ensure_collection()
    offset: PointId | None = None
    total = 0

    client = QdrantClient(url=settings.QDRANT_URL)
    while True:
        records, offset = client.scroll(
            collection_name=SOURCE_COLLECTION_NAME,
            offset=offset,
            limit=vector_store.UPSERT_BATCH_SIZE,
            with_payload=True,
            with_vectors=True,
        )

        record_ids = []

        for record in records:
            record_ids.append(record.id)

        existing = client.retrieve(
            collection_name=vector_store.COLLECTION_NAME,
            ids=record_ids,
            with_payload=False,
            with_vectors=False,
        )
        existing_ids = set()

        for record in existing:
            existing_ids.add(record.id)

        points: list[models.PointStruct] = []

        for record in records:
            if record.id in existing_ids:
                continue

            if record.payload is None or not isinstance(record.vector, dict):
                raise RuntimeError("Qdrant 切片缺少 Payload 或命名向量")

            points.append(
                models.PointStruct(
                    id=record.id,
                    vector={
                        vector_store.VECTOR_NAME: record.vector[
                            vector_store.VECTOR_NAME
                        ],
                        vector_store.BM25_VECTOR_NAME: bm25.embed_text(
                            str(record.payload["content"])
                        ),
                    },
                    payload=record.payload,
                )
            )

        if points:
            client.upsert(
                collection_name=vector_store.COLLECTION_NAME,
                points=points,
                wait=True,
            )
            total += len(points)
            logger.info("已补建 %s 个切片的 BM25 索引", total)

        if offset is None:
            break

    client.close()

    logger.info("BM25 索引补建完成：%s 个切片", total)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
