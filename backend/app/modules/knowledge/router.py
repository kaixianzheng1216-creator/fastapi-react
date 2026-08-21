import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import SessionDep
from app.modules.auth.dependencies import CurrentUser, get_current_active_superuser
from app.modules.files import object_storage
from app.modules.files.schemas import FileCompletePublic
from app.modules.knowledge import documents, retrieval, service
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBasePublic,
    KnowledgeBasesPublic,
    KnowledgeBaseUpdate,
    KnowledgeDocumentPreviewPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentsPublic,
    KnowledgeDocumentUploadPublic,
    KnowledgeDocumentUploadRequest,
    KnowledgeSearchRequest,
    KnowledgeSearchResultsPublic,
)

router = APIRouter(
    prefix="/admin/knowledge-bases",
    tags=["knowledge-bases"],
    dependencies=[Depends(get_current_active_superuser)],
)

document_router = APIRouter(
    prefix="/admin/knowledge-documents",
    tags=["knowledge-documents"],
    dependencies=[Depends(get_current_active_superuser)],
)


@router.post(
    "", response_model=KnowledgeBasePublic, status_code=status.HTTP_201_CREATED
)
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
def delete_knowledge_base(session: SessionDep, knowledge_base_id: uuid.UUID) -> None:
    service.delete_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)


@router.post(
    "/{knowledge_base_id}/documents/uploads",
    response_model=KnowledgeDocumentUploadPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_document_upload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeDocumentUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    return documents.create_upload(
        session=session,
        current_user=current_user,
        knowledge_base_id=knowledge_base_id,
        upload_request=body,
    )


@router.get(
    "/{knowledge_base_id}/documents",
    response_model=KnowledgeDocumentsPublic,
)
def read_documents(
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> KnowledgeDocumentsPublic:
    rows, count = documents.list_documents(
        session=session,
        knowledge_base_id=knowledge_base_id,
        skip=skip,
        limit=limit,
    )

    return KnowledgeDocumentsPublic(
        data=[
            documents.to_public(document, stored_file) for document, stored_file in rows
        ],
        count=count,
    )


@router.post(
    "/{knowledge_base_id}/search",
    response_model=KnowledgeSearchResultsPublic,
)
def search_knowledge_base(
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeSearchRequest,
) -> KnowledgeSearchResultsPublic:
    return KnowledgeSearchResultsPublic(
        data=retrieval.search_knowledge_base(
            session=session,
            knowledge_base_id=knowledge_base_id,
            query=body.query,
        )
    )


@document_router.post(
    "/{document_id}/complete",
    response_model=KnowledgeDocumentPublic,
)
async def complete_document_upload(
    session: SessionDep,
    document_id: uuid.UUID,
) -> KnowledgeDocumentPublic:
    return await documents.complete_upload(
        session=session,
        document_id=document_id,
    )


@document_router.get(
    "/{document_id}/preview",
    response_model=KnowledgeDocumentPreviewPublic,
)
def read_document_preview(
    session: SessionDep,
    document_id: uuid.UUID,
) -> KnowledgeDocumentPreviewPublic:
    return documents.get_preview(session=session, document_id=document_id)


@document_router.get(
    "/{document_id}/download",
    response_model=FileCompletePublic,
)
def download_original_document(
    session: SessionDep,
    document_id: uuid.UUID,
) -> FileCompletePublic:
    stored_file = documents.get_original_file(
        session=session,
        document_id=document_id,
    )

    return FileCompletePublic(
        id=stored_file.id,
        download_url=object_storage.create_download_url(
            stored_file.object_key,
            stored_file.filename,
        ),
    )


@document_router.post("/{document_id}/retry", status_code=status.HTTP_204_NO_CONTENT)
def retry_document(session: SessionDep, document_id: uuid.UUID) -> None:
    documents.retry_document(session=session, document_id=document_id)


@document_router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(session: SessionDep, document_id: uuid.UUID) -> None:
    documents.delete_document(session=session, document_id=document_id)
