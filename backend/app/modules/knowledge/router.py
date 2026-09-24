import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Body, Path, Query, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.common.exceptions import ApplicationError
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
from app.modules.knowledge.access import KnowledgeAccessDep
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
    KnowledgeDocumentCompleteResult,
    KnowledgeDocumentMove,
    KnowledgeDocumentPreviewPublic,
    KnowledgeDocumentPublic,
    KnowledgeDocumentUploadPublic,
    KnowledgeDocumentUploadResult,
    KnowledgeFolderCreate,
    KnowledgeFolderMove,
    KnowledgeFolderPublic,
    KnowledgeFoldersPublic,
    KnowledgeFolderUpdate,
    KnowledgeSearchRequest,
    KnowledgeSearchResultsPublic,
    KnowledgeWebpageCreate,
)
from app.modules.mcp_keys.models import McpPermission
from app.modules.users.exceptions import InsufficientPrivilegesError

ADMIN_ERROR_RESPONSES = error_responses(
    CredentialsValidationError,
    InactiveUserError,
    InsufficientPrivilegesError,
)

router = APIRouter(
    prefix="/admin/knowledge-bases",
    tags=["knowledge-bases"],
    responses=ADMIN_ERROR_RESPONSES,
)

document_router = APIRouter(
    prefix="/admin/knowledge-documents",
    tags=["knowledge-documents"],
    responses=ADMIN_ERROR_RESPONSES,
)


@router.post(
    "",
    response_model=KnowledgeBasePublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(KnowledgeBaseAlreadyExistsError),
)
def create_knowledge_base(
    *, session: SessionDep, access: KnowledgeAccessDep, body: KnowledgeBaseCreate
) -> KnowledgeBasePublic:
    """创建知识库。"""
    body = body.model_copy(
        update={"project_id": access.project(session, body.project_id, write=True)}
    )

    knowledge_base = service.create_knowledge_base(
        session=session, knowledge_base_create=body
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.get("", response_model=KnowledgeBasesPublic)
def read_knowledge_bases(
    session: SessionDep,
    access: KnowledgeAccessDep,
    project_id: Annotated[
        uuid.UUID | None, Query(description="所属项目 ID；后台必填，MCP 由密钥确定")
    ] = None,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
    search: Annotated[
        str | None,
        Query(max_length=100, description="按知识库名称、描述搜索"),
    ] = None,
    is_enabled: Annotated[
        bool | None,
        Query(description="按启用状态筛选：true=启用，false=停用；不传则返回全部"),
    ] = None,
) -> KnowledgeBasesPublic:
    """查询知识库列表。"""
    project_id = access.project(session, project_id)

    enabled_filter = is_enabled

    if access.key is not None and access.key.permission == McpPermission.READ_ONLY:
        enabled_filter = True

    knowledge_bases, count = service.list_knowledge_bases(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
        is_enabled=enabled_filter,
        project_id=project_id,
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
    session: SessionDep,
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
) -> KnowledgeBasePublic:
    """根据 ID 获取指定知识库。"""
    knowledge_base = access.base(session, knowledge_base_id)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: KnowledgeBaseUpdate,
) -> KnowledgeBasePublic:
    """更新知识库。"""
    knowledge_base = access.base(session, knowledge_base_id, write=True)

    knowledge_base = service.update_knowledge_base(
        session=session,
        knowledge_base=knowledge_base,
        knowledge_base_update=body,
    )

    return KnowledgeBasePublic.model_validate(knowledge_base)


@router.delete(
    "/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(KnowledgeBaseNotFoundError),
)
def delete_knowledge_base(
    session: SessionDep,
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
) -> None:
    """删除知识库。"""
    access.base(session, knowledge_base_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: KnowledgeFolderCreate,
) -> KnowledgeFolderPublic:
    """创建知识库文件夹。"""
    access.base(session, knowledge_base_id, write=True)

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
    session: SessionDep,
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
) -> KnowledgeFoldersPublic:
    """查询知识库文件夹列表。"""
    access.base(session, knowledge_base_id, write=False)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    folder_id: Annotated[uuid.UUID, Path(description="文件夹 ID")],
    body: KnowledgeFolderUpdate,
) -> KnowledgeFolderPublic:
    """重命名知识库文件夹。"""
    access.base(session, knowledge_base_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    folder_id: Annotated[uuid.UUID, Path(description="文件夹 ID")],
    body: KnowledgeFolderMove = Body(default_factory=KnowledgeFolderMove),
) -> KnowledgeFolderPublic:
    """移动知识库文件夹。"""
    access.base(session, knowledge_base_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    folder_id: Annotated[
        uuid.UUID | None,
        Query(description="文件夹 ID；不传表示根目录"),
    ] = None,
    document_status: Annotated[
        Literal["ready", "processing", "failed"] | None,
        Query(description="按知识库内文档状态筛选；筛选时不返回文件夹"),
    ] = None,
    skip: Annotated[int, Query(ge=0, description="跳过的记录数")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="返回的最大记录数")] = 20,
) -> KnowledgeDirectoryPublic:
    """查询目录及全库文档状态数量。document_status 可筛选已完成、处理中或失败的文档。"""
    access.base(session, knowledge_base_id, write=False)

    entries, count, status_counts = service.list_directory(
        session=session,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        document_status=document_status,
        skip=skip,
        limit=limit,
    )

    return KnowledgeDirectoryPublic(
        data=entries, count=count, status_counts=status_counts
    )


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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: KnowledgeDirectoryDelete,
) -> None:
    """批量删除知识库文件夹和文档。"""
    access.base(session, knowledge_base_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    folder_id: Annotated[
        uuid.UUID | None,
        Query(description="导入到的文件夹 ID；不传表示根目录"),
    ] = None,
    body: FileUploadRequest,
) -> KnowledgeDocumentUploadPublic:
    """创建知识库文档上传凭证。

    使用返回的 uploadUrl 和 uploadHeaders 通过 HTTP PUT 上传完整文件内容，
    然后调用 knowledge_document_upload_complete 确认上传。
    """
    access.base(session, knowledge_base_id, write=True)
    return service.create_document_upload(
        session=session,
        owner_id=access.owner_id,
        knowledge_base_id=knowledge_base_id,
        folder_id=folder_id,
        upload_request=body,
    )


@router.post(
    "/{knowledge_base_id}/documents/uploads/batch",
    response_model=list[KnowledgeDocumentUploadResult],
)
def create_document_uploads(
    *,
    session: SessionDep,
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: Annotated[list[FileUploadRequest], Body(min_length=1, max_length=100)],
    folder_id: Annotated[
        uuid.UUID | None,
        Query(description="导入到的文件夹 ID；不传表示根目录"),
    ] = None,
) -> list[KnowledgeDocumentUploadResult]:
    """批量创建知识库文档上传凭证，每次 1–100 个，结果与输入顺序一致。

    每项返回 upload 或 error；成功项通过 uploadUrl 和 uploadHeaders
    使用 HTTP PUT 上传原始文件内容，再调用 knowledge_document_uploads_complete。
    单项失败不影响其他项，只需重试失败项，避免重复创建成功项。
    """
    access.base(session, knowledge_base_id, write=True)

    results = []

    for upload_request in body:
        try:
            upload = service.create_document_upload(
                session=session,
                owner_id=access.owner_id,
                knowledge_base_id=knowledge_base_id,
                folder_id=folder_id,
                upload_request=upload_request,
            )
        except ApplicationError as error:
            session.rollback()
            results.append(
                KnowledgeDocumentUploadResult(
                    filename=upload_request.filename, error=error.detail
                )
            )
        else:
            results.append(
                KnowledgeDocumentUploadResult(
                    filename=upload_request.filename, upload=upload
                )
            )

    return results


@document_router.post(
    "/uploads/complete",
    response_model=list[KnowledgeDocumentCompleteResult],
)
async def complete_document_uploads(
    session: SessionDep,
    access: KnowledgeAccessDep,
    body: Annotated[
        list[uuid.UUID],
        Body(min_length=1, max_length=100, description="已完成 HTTP PUT 上传的文档 ID"),
    ],
) -> list[KnowledgeDocumentCompleteResult]:
    """批量确认知识库文档上传，每次 1–100 个，结果与输入顺序一致。

    每项返回 document 或 error；成功项进入文档处理流程。
    单项失败不影响其他项；未上传或存储暂时不可用时，可使用原文档 ID 重试确认。
    文件大小不符时，该上传记录会被删除，需要重新创建凭证并上传。
    """
    results = []

    for document_id in body:
        try:
            access.document(session, document_id, write=True)

            document = await documents.complete_upload(
                session=session, document_id=document_id
            )
        except ApplicationError as error:
            session.rollback()
            results.append(
                KnowledgeDocumentCompleteResult(id=document_id, error=error.detail)
            )
        else:
            results.append(
                KnowledgeDocumentCompleteResult(id=document_id, document=document)
            )

    return results


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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="待确认上传的文档 ID")],
) -> KnowledgeDocumentPublic:
    """确认知识库文档上传。

    仅在文件已通过 knowledge_document_upload_create 返回的 uploadUrl 上传后调用。
    确认成功后，文档进入处理流程。
    """
    access.document(session, document_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    folder_id: Annotated[
        uuid.UUID | None,
        Query(description="导入到的文件夹 ID；不传表示根目录"),
    ] = None,
    body: KnowledgeWebpageCreate,
) -> KnowledgeDocumentPublic:
    """从网页导入知识库文档。"""
    access.base(session, knowledge_base_id, write=True)
    return await service.create_webpage_document(
        session=session,
        owner_id=access.owner_id,
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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
) -> KnowledgeDocumentPublic:
    """根据 ID 获取指定知识库文档。"""
    access.document(session, document_id, write=False)

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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
) -> KnowledgeDocumentPreviewPublic:
    """获取知识库文档 Markdown 预览。"""
    access.document(session, document_id, write=False)

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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
    skip: Annotated[int, Query(ge=0, description="跳过的切片数")] = 0,
    limit: Annotated[
        int,
        Query(ge=1, le=100, description="返回的最大切片数"),
    ] = 20,
) -> KnowledgeDocumentChunksPublic:
    """获取知识库文档切片列表。"""
    access.document(session, document_id, write=False)

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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
) -> FileCompletePublic:
    """获取知识库文档原文件下载地址。"""
    access.document(session, document_id, write=False)

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
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
    body: KnowledgeDocumentMove = Body(default_factory=KnowledgeDocumentMove),
) -> KnowledgeDocumentPublic:
    """移动知识库文档。"""
    access.document(session, document_id, write=True)

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
def retry_document(
    session: SessionDep,
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
) -> None:
    """重试知识库文档处理。"""
    access.document(session, document_id, write=True)

    documents.retry_document(session=session, document_id=document_id)


@document_router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(KnowledgeDocumentNotFoundError),
)
def delete_document(
    session: SessionDep,
    access: KnowledgeAccessDep,
    document_id: Annotated[uuid.UUID, Path(description="知识库文档 ID")],
) -> None:
    """删除知识库文档。"""
    access.document(session, document_id, write=True)

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
    access: KnowledgeAccessDep,
    knowledge_base_id: Annotated[uuid.UUID, Path(description="知识库 ID")],
    body: KnowledgeSearchRequest,
) -> KnowledgeSearchResultsPublic:
    """检索知识库内容。"""
    access.base(session, knowledge_base_id, write=False)

    search_results = retrieval.search_knowledge_base(
        session=session,
        knowledge_base_id=knowledge_base_id,
        query=body.query,
    )

    return KnowledgeSearchResultsPublic(data=search_results, count=len(search_results))
