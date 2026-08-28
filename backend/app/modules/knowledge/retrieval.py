import logging
import uuid

from sqlmodel import Session, col, select

from app.modules.knowledge import document_images, embedding, vector_store
from app.modules.knowledge.exceptions import KnowledgeSearchUnavailableError
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus
from app.modules.knowledge.schemas import KnowledgeSearchResultPublic
from app.modules.knowledge.service import get_knowledge_base

SEARCH_ERROR_LOG = "知识库检索失败"
SEARCH_RESULT_LIMIT = 5
logger = logging.getLogger(__name__)


def search_knowledge_base(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    query: str,
) -> list[KnowledgeSearchResultPublic]:
    knowledge_base = get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    ready_document_ids = session.exec(
        select(KnowledgeDocument.id).where(
            col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id,
            col(KnowledgeDocument.status) == KnowledgeDocumentStatus.READY,
        )
    ).all()

    if not ready_document_ids:
        return []

    try:
        query_vector = embedding.embed_texts([query])[0]

        matches = vector_store.search(
            vector=query_vector,
            knowledge_base_id=knowledge_base_id,
            document_ids=ready_document_ids,
            limit=SEARCH_RESULT_LIMIT,
        )
    except (
        embedding.EmbeddingServiceError,
        vector_store.VectorStoreUnavailableError,
    ) as error:
        logger.exception(SEARCH_ERROR_LOG)

        raise KnowledgeSearchUnavailableError from error

    search_results: list[KnowledgeSearchResultPublic] = []

    for match in matches:
        image_urls: list[str] = []

        for image_name in match.image_names:
            image_url = document_images.create_image_download_url(
                match.document_id,
                image_name,
            )

            image_urls.append(image_url)

        search_results.append(
            KnowledgeSearchResultPublic(
                document_id=match.document_id,
                chunk_index=match.chunk_index,
                knowledge_base_name=knowledge_base.name,
                filename=match.filename,
                content=match.content,
                section_path=match.section_path,
                page_numbers=match.page_numbers,
                image_urls=image_urls,
                score=match.score,
            )
        )

    return search_results
