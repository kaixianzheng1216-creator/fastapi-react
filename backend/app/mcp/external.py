import uuid
from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.knowledge import retrieval
from app.modules.knowledge import service as knowledge_service
from app.modules.knowledge.exceptions import (
    KnowledgeBaseNotFoundError,
    KnowledgeSearchUnavailableError,
)
from app.modules.knowledge.schemas import (
    KnowledgeBaseSummariesPublic,
    KnowledgeBaseSummaryPublic,
    KnowledgeSearchRequest,
    KnowledgeSearchResultsPublic,
)

router = APIRouter(prefix="/external")


@router.get(
    "/knowledge-bases",
    tags=["external-knowledge"],
    response_model=KnowledgeBaseSummariesPublic,
)
def read_external_knowledge_bases(
    session: SessionDep,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
    search: Annotated[
        str | None,
        Query(max_length=100, description="按知识库名称搜索"),
    ] = None,
) -> KnowledgeBaseSummariesPublic:
    """查询已启用的知识库列表。"""
    knowledge_bases, count = knowledge_service.list_knowledge_bases(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
        is_enabled=True,
    )

    return KnowledgeBaseSummariesPublic(
        data=[
            KnowledgeBaseSummaryPublic.model_validate(knowledge_base)
            for knowledge_base in knowledge_bases
        ],
        count=count,
    )


@router.post(
    "/knowledge-bases/{knowledge_base_id}/search",
    tags=["external-knowledge"],
    response_model=KnowledgeSearchResultsPublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeSearchUnavailableError,
    ),
)
def search_external_knowledge_base(
    session: SessionDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: KnowledgeSearchRequest,
) -> KnowledgeSearchResultsPublic:
    """检索已启用的知识库内容。"""
    knowledge_base = knowledge_service.get_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    if not knowledge_base.is_enabled:
        raise KnowledgeBaseNotFoundError

    search_results = retrieval.search_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        query=body.query,
    )

    return KnowledgeSearchResultsPublic(data=search_results, count=len(search_results))
