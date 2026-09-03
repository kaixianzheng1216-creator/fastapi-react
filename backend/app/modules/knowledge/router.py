import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import CurrentUser, get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.files import object_storage
from app.modules.files.exceptions import (
    FileSizeMismatchError,
    FileStorageUnavailableError,
    FileTypeNotAllowedError,
    FileUploadIncompleteError,
)
from app.modules.files.schemas import FileCompletePublic, FileUploadRequest
from app.modules.knowledge import documents, retrieval, service
from app.modules.knowledge.exceptions import (
    KnowledgeBaseAlreadyExistsError,
    KnowledgeBaseNotFoundError,
    KnowledgeDocumentArtifactUnavailableError,
    KnowledgeDocumentNotFoundError,
    KnowledgeDocumentStateError,
    KnowledgeFolderAlreadyExistsError,
    KnowledgeFolderInvalidParentError,
    KnowledgeFolderNotFoundError,
    KnowledgeSearchUnavailableError,
    WebpageScrapeError,
    WebpageScrapeUnavailableError,
    WebpageTooLargeError,
)
from app.modules.knowledge.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBasePublic,
    KnowledgeBasesPublic,
    KnowledgeBaseUpdate,
    KnowledgeDirectoryDelete,
    KnowledgeDirectoryPublic,
    KnowledgeDocumentChunksPublic,
    KnowledgeDocumentMove,
    KnowledgeDocumentPreviewPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentUploadPublic,
    KnowledgeFolderCreate,
    KnowledgeFolderMove,
    KnowledgeFolderPublic,
    KnowledgeFoldersPublic,
    KnowledgeFolderUpdate,
    KnowledgeSearchRequest,
    KnowledgeSearchResultsPublic,
    KnowledgeWebpageCreate,
)
from app.modules.users.exceptions import InsufficientPrivilegesError

ADMIN_ERROR_RESPONSES = error_responses(
    CredentialsValidationError,
    InactiveUserError,
    InsufficientPrivilegesError,
)

router = APIRouter(
    prefix="/admin/knowledge-bases",
    tags=["knowledge-bases"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=ADMIN_ERROR_RESPONSES,
)

document_router = APIRouter(
    prefix="/admin/knowledge-documents",
    tags=["knowledge-documents"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=ADMIN_ERROR_RESPONSES,
)


@router.post(
    "",
    response_model=KnowledgeBasePublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(KnowledgeBaseAlreadyExistsError),
)
def create_knowledge_base(
    *, session: SessionDep, body: KnowledgeBaseCreate
) -> KnowledgeBasePublic:
    """创建知识库。"""
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
    """获取知识库列表。"""
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


@router.get(
    "/{knowledge_base_id}",
    response_model=KnowledgeBasePublic,
    responses=error_responses(KnowledgeBaseNotFoundError),
)
def read_knowledge_base(
    session: SessionDep, knowledge_base_id: uuid.UUID
) -> KnowledgeBasePublic:
    """根据 ID 获取指定知识库。"""
    knowledge_base = service.get_knowledge_base(
        session=session, knowledge_base_id=knowledge_base_id
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.patch(
    "/{knowledge_base_id}",
    response_model=KnowledgeBasePublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeBaseAlreadyExistsError,
    ),
)
def update_knowledge_base(
    *,
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeBaseUpdate,
) -> KnowledgeBasePublic:
    """更新知识库。"""
    knowledge_base = service.update_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        knowledge_base_update=body,
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.delete(
    "/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(KnowledgeBaseNotFoundError),
)
def delete_knowledge_base(session: SessionDep, knowledge_base_id: uuid.UUID) -> None:
    """删除知识库。"""
    service.delete_knowledge_base(session=session, knowledge_base_id=knowledge_base_id)


@router.post(
    "/{knowledge_base_id}/folders",
    response_model=KnowledgeFolderPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        KnowledgeFolderAlreadyExistsError,
    ),
)
def create_folder(
    *,
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeFolderCreate,
) -> KnowledgeFolderPublic:
    """创建知识库文件夹。"""
    folder = service.create_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_create=body,
    )

    return KnowledgeFolderPublic.model_validate(folder)


@router.get(
    "/{knowledge_base_id}/folders",
    response_model=KnowledgeFoldersPublic,
    responses=error_responses(KnowledgeBaseNotFoundError),
)
def read_folders(
    session: SessionDep, knowledge_base_id: uuid.UUID
) -> KnowledgeFoldersPublic:
    """获取知识库文件夹。"""
    folders = service.list_folders(
        session=session,
        knowledge_base_id=knowledge_base_id,
    )

    data: list[KnowledgeFolderPublic] = []

    for folder in folders:
        data.append(KnowledgeFolderPublic.model_validate(folder))

    return KnowledgeFoldersPublic(
        data=data,
        count=len(folders),
    )


@router.patch(
    "/{knowledge_base_id}/folders/{folder_id}",
    response_model=KnowledgeFolderPublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        KnowledgeFolderAlreadyExistsError,
    ),
)
def update_folder(
    *,
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: KnowledgeFolderUpdate,
) -> KnowledgeFolderPublic:
    """重命名知识库文件夹。"""
    folder = service.update_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        folder_update=body,
    )

    return KnowledgeFolderPublic.model_validate(folder)


@router.patch(
    "/{knowledge_base_id}/folders/{folder_id}/parent",
    response_model=KnowledgeFolderPublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        KnowledgeFolderInvalidParentError,
        KnowledgeFolderAlreadyExistsError,
    ),
)
def move_folder(
    *,
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: KnowledgeFolderMove,
) -> KnowledgeFolderPublic:
    """移动知识库文件夹。"""
    folder = service.move_folder(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        target_parent_id=body.parent_id,
    )

    return KnowledgeFolderPublic.model_validate(folder)


@router.get(
    "/{knowledge_base_id}/entries",
    response_model=KnowledgeDirectoryPublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
    ),
)
def read_directory(
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> KnowledgeDirectoryPublic:
    """获取文件夹优先排列的知识库目录。"""
    entries, count = service.list_directory(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        skip=skip,
        limit=limit,
    )

    return KnowledgeDirectoryPublic(data=entries, count=count)


@router.post(
    "/{knowledge_base_id}/directory/batch-delete",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        KnowledgeDocumentNotFoundError,
    ),
)
def delete_directory_entries(
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeDirectoryDelete,
) -> None:
    """批量删除知识库文件夹和文档。"""
    service.delete_directory_entries(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_ids=body.folder_ids,
        document_ids=body.document_ids,
    )


@router.post(
    "/{knowledge_base_id}/documents/uploads",
    response_model=KnowledgeDocumentUploadPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        FileTypeNotAllowedError,
        FileStorageUnavailableError,
    ),
)
def create_document_upload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    body: FileUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    """创建知识库文档上传凭证。"""
    return service.create_document_upload(
        session=session,
        current_user=current_user,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        upload_request=body,
    )


@document_router.post(
    "/{document_id}/complete",
    response_model=KnowledgeDocumentPublic,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        FileUploadIncompleteError,
        FileSizeMismatchError,
        FileStorageUnavailableError,
    ),
)
async def complete_document_upload(
    session: SessionDep,
    document_id: uuid.UUID,
) -> KnowledgeDocumentPublic:
    """确认知识库文档上传。"""
    return await documents.complete_upload(
        session=session,
        document_id=document_id,
    )


@router.post(
    "/{knowledge_base_id}/documents/webpages",
    response_model=KnowledgeDocumentPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
        WebpageScrapeError,
        WebpageScrapeUnavailableError,
        WebpageTooLargeError,
        FileStorageUnavailableError,
    ),
)
async def create_webpage_document(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    knowledge_base_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    body: KnowledgeWebpageCreate,
) -> KnowledgeDocumentPublic:
    """抓取网页并创建知识库文档。"""
    return await service.create_webpage_document(
        session=session,
        current_user=current_user,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        url=str(body.url),
    )


@document_router.get(
    "/{document_id}",
    response_model=KnowledgeDocumentPublic,
    responses=error_responses(KnowledgeDocumentNotFoundError),
)
def read_document(
    session: SessionDep,
    document_id: uuid.UUID,
) -> KnowledgeDocumentPublic:
    """根据 ID 获取指定知识库文档。"""
    return documents.get_document(session=session, document_id=document_id)


@document_router.get(
    "/{document_id}/preview",
    response_model=KnowledgeDocumentPreviewPublic,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        KnowledgeDocumentArtifactUnavailableError,
        FileStorageUnavailableError,
    ),
)
def read_document_preview(
    session: SessionDep,
    document_id: uuid.UUID,
) -> KnowledgeDocumentPreviewPublic:
    """获取知识库文档 Markdown 预览。"""
    return documents.get_preview(session=session, document_id=document_id)


@document_router.get(
    "/{document_id}/chunks",
    response_model=KnowledgeDocumentChunksPublic,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        KnowledgeDocumentArtifactUnavailableError,
    ),
)
def read_document_chunks(
    session: SessionDep,
    document_id: uuid.UUID,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> KnowledgeDocumentChunksPublic:
    """获取知识库文档切片列表。"""
    chunks, count = documents.list_document_chunks(
        session=session,
        document_id=document_id,
        skip=skip,
        limit=limit,
    )

    return KnowledgeDocumentChunksPublic(data=chunks, count=count)


@document_router.get(
    "/{document_id}/download",
    response_model=FileCompletePublic,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        FileUploadIncompleteError,
        FileStorageUnavailableError,
    ),
)
def download_original_document(
    session: SessionDep,
    document_id: uuid.UUID,
) -> FileCompletePublic:
    """获取知识库文档原文件下载地址。"""
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


@document_router.patch(
    "/{document_id}/folder",
    response_model=KnowledgeDocumentPublic,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        KnowledgeBaseNotFoundError,
        KnowledgeFolderNotFoundError,
    ),
)
def move_document(
    *,
    session: SessionDep,
    document_id: uuid.UUID,
    body: KnowledgeDocumentMove,
) -> KnowledgeDocumentPublic:
    """移动知识库文档。"""
    return service.move_document(
        session=session,
        document_id=document_id,
        folder_id=body.folder_id,
    )


@document_router.post(
    "/{document_id}/retry",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(
        KnowledgeDocumentNotFoundError,
        KnowledgeDocumentStateError,
    ),
)
def retry_document(session: SessionDep, document_id: uuid.UUID) -> None:
    """重试知识库文档处理。"""
    documents.retry_document(session=session, document_id=document_id)


@document_router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(KnowledgeDocumentNotFoundError),
)
def delete_document(session: SessionDep, document_id: uuid.UUID) -> None:
    """删除知识库文档。"""
    documents.delete_document(session=session, document_id=document_id)


@router.post(
    "/{knowledge_base_id}/search",
    response_model=KnowledgeSearchResultsPublic,
    responses=error_responses(
        KnowledgeBaseNotFoundError,
        KnowledgeSearchUnavailableError,
    ),
)
def search_knowledge_base(
    session: SessionDep,
    knowledge_base_id: uuid.UUID,
    body: KnowledgeSearchRequest,
) -> KnowledgeSearchResultsPublic:
    """检索知识库。"""
    search_results = retrieval.search_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        query=body.query,
    )

    return KnowledgeSearchResultsPublic(data=search_results, count=len(search_results))
