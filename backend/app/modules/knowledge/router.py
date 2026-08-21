import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import SessionDep
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.knowledge import service
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBasePublic,
    KnowledgeBasesPublic,
    KnowledgeBaseUpdate,
)

router = APIRouter(
    prefix="/admin/knowledge-bases",
    tags=["knowledge-bases"],
    dependencies=[Depends(get_current_active_superuser)],
)


@router.post("", response_model=KnowledgeBasePublic, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    *, session: SessionDep, body: KnowledgeBaseCreate
) -> KnowledgeBasePublic:
    knowledge_base = service.create_knowledge_base(
        session=session, knowledge_base_create=body
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.get("", response_model=KnowledgeBasesPublic)
def read_knowledge_bases(
    session: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[str | None, Query(max_length=100)] = None,
    is_enabled: bool | None = None,
) -> KnowledgeBasesPublic:
    knowledge_bases, count = service.list_knowledge_bases(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
        is_enabled=is_enabled,
    )

    return KnowledgeBasesPublic(
        data=[
            KnowledgeBasePublic.model_validate(knowledge_base)
            for knowledge_base in knowledge_bases
        ],
        count=count,
    )


@router.get("/{knowledge_base_id}", response_model=KnowledgeBasePublic)
def read_knowledge_base(
    session: SessionDep, knowledge_base_id: uuid.UUID
) -> KnowledgeBasePublic:
    knowledge_base = service.get_knowledge_base(
        session=session, knowledge_base_id=knowledge_base_id
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.patch("/{knowledge_base_id}", response_model=KnowledgeBasePublic)
def update_knowledge_base(
    *,
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeBaseUpdate,
) -> KnowledgeBasePublic:
    knowledge_base = service.update_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        knowledge_base_update=body,
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.delete("/{knowledge_base_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    session: SessionDep, knowledge_base_id: uuid.UUID
) -> None:
    service.delete_knowledge_base(
        session=session, knowledge_base_id=knowledge_base_id
    )
