import logging
import uuid

from sqlmodel import Session, col, select

from app.modules.knowledge import embedding, vector_store
from app.modules.knowledge.exceptions import KnowledgeSearchUnavailableError
from app.modules.knowledge.models import KnowledgeDocument
from app.modules.knowledge.schemas import KnowledgeSearchResultPublic
from app.modules.knowledge.service import get_knowledge_base

SEARCH_ERROR_LOG = "知识库检索失败"
logger = logging.getLogger(__name__)


def search_knowledge_base(
    *, session: Session, knowledge_base_id: uuid.UUID, query: str
) -> list[KnowledgeSearchResultPublic]:
    get_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)
    document_ids = session.exec(
        select(KnowledgeDocument.id).where(
            col(KnowledgeDocument.knowledge_base_id) == knowledge_base_id,
            col(KnowledgeDocument.status) == "ready",
        )
    ).all()

    if not document_ids:
        return []

    try:
        vector = embedding.embed_texts([query])[0]

        return vector_store.search(
            vector=vector,
            knowledge_base_ids=[knowledge_base_id],
            document_ids=document_ids,
        )
    except Exception as error:
        logger.exception(SEARCH_ERROR_LOG)

        raise KnowledgeSearchUnavailableError from error
