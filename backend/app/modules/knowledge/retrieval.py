import logging
import uuid

from sqlmodel import Session, col, select

from app.modules.knowledge import embedding, vector_store
from app.modules.knowledge.exceptions import KnowledgeSearchUnavailableError
from app.modules.knowledge.models import KnowledgeDocument, KnowledgeDocumentStatus
from app.modules.knowledge.schemas import KnowledgeSearchResultPublic
from app.modules.knowledge.service import get_knowledge_base

SEARCH_ERROR_LOG = "知识库检索失败"
logger = logging.getLogger(__name__)


def search_knowledge_base(
    *,
    session: Session,
    knowledge_base_id: uuid.UUID,
    query: str,
    skip: int,
    limit: int,
) -> tuple[list[KnowledgeSearchResultPublic], int]:
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
        return [], 0

    try:
        query_vector = embedding.embed_texts([query])[0]

        search_results, count = vector_store.search(
            vector=query_vector,
            knowledge_base_id=knowledge_base_id,
            knowledge_base_name=knowledge_base.name,
            document_ids=ready_document_ids,
            skip=skip,
            limit=limit,
        )
    except (
        embedding.EmbeddingServiceError,
        vector_store.VectorStoreUnavailableError,
    ) as error:
        logger.exception(SEARCH_ERROR_LOG)

        raise KnowledgeSearchUnavailableError from error

    return search_results, count
