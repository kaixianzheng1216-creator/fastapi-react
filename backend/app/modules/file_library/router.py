import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import CurrentUser, get_current_active_superuser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.file_library import documents, service
from app.modules.file_library.exceptions import (
    FileLibraryAlreadyExistsError,
    FileLibraryNotFoundError,
    LibraryDocumentNotFoundError,
    LibraryFolderAlreadyExistsError,
    LibraryFolderInvalidParentError,
    LibraryFolderNotFoundError,
)
from app.modules.file_library.schemas import (
    FileLibrariesPublic,
    FileLibraryCreate,
    FileLibraryPublic,
    FileLibraryUpdate,
    LibraryDirectoryDelete,
    LibraryDirectoryPublic,
    LibraryDocumentMove,
    LibraryDocumentPublic,
    LibraryDocumentUploadPublic,
    LibraryFolderCreate,
    LibraryFolderMove,
    LibraryFolderPublic,
    LibraryFoldersPublic,
    LibraryFolderUpdate,
)
from app.modules.files import object_storage
from app.modules.files.exceptions import (
    FileSizeMismatchError,
    FileStorageUnavailableError,
    FileUploadIncompleteError,
)
from app.modules.files.schemas import FileCompletePublic, FileUploadRequest
from app.modules.users.exceptions import InsufficientPrivilegesError

ADMIN_ERROR_RESPONSES = error_responses(
    CredentialsValidationError,
    InactiveUserError,
    InsufficientPrivilegesError,
)

router = APIRouter(
    prefix="/admin/file-libraries",
    tags=["file-libraries"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=ADMIN_ERROR_RESPONSES,
)

document_router = APIRouter(
    prefix="/admin/library-documents",
    tags=["library-documents"],
    dependencies=[Depends(get_current_active_superuser)],
    responses=ADMIN_ERROR_RESPONSES,
)


@router.post(
    "",
    response_model=FileLibraryPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(FileLibraryAlreadyExistsError),
)
def create_file_library(
    *, session: SessionDep, body: FileLibraryCreate
) -> FileLibraryPublic:
    """创建文件库。"""
    file_library = service.create_file_library(
        session=session, file_library_create=body
    )

    return FileLibraryPublic.model_validate(file_library)


@router.get("", response_model=FileLibrariesPublic)
def read_file_libraries(
    session: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    search: Annotated[
        str | None,
        Query(max_length=100),
    ] = None,
) -> FileLibrariesPublic:
    """查询文件库列表。"""
    file_libraries, count = service.list_file_libraries(
        session=session,
        skip=skip,
        limit=limit,
        search=search,
    )

    return FileLibrariesPublic(
        data=[
            FileLibraryPublic.model_validate(file_library)
            for file_library in file_libraries
        ],
        count=count,
    )


@router.get(
    "/{file_library_id}",
    response_model=FileLibraryPublic,
    responses=error_responses(FileLibraryNotFoundError),
)
def read_file_library(
    session: SessionDep, file_library_id: uuid.UUID
) -> FileLibraryPublic:
    """根据 ID 获取指定文件库。"""
    file_library = service.get_file_library(
        session=session, file_library_id=file_library_id
    )

    return FileLibraryPublic.model_validate(file_library)


@router.patch(
    "/{file_library_id}",
    response_model=FileLibraryPublic,
    responses=error_responses(
        FileLibraryNotFoundError,
        FileLibraryAlreadyExistsError,
    ),
)
def update_file_library(
    *,
    session: SessionDep,
    file_library_id: uuid.UUID,
    body: FileLibraryUpdate,
) -> FileLibraryPublic:
    """更新文件库。"""
    file_library = service.update_file_library(
        session=session,
        file_library_id=file_library_id,
        file_library_update=body,
    )

    return FileLibraryPublic.model_validate(file_library)


@router.delete(
    "/{file_library_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(FileLibraryNotFoundError),
)
def delete_file_library(
    session: SessionDep,
    file_library_id: uuid.UUID,
) -> None:
    """删除文件库。"""
    service.delete_file_library(session=session, file_library_id=file_library_id)


@router.post(
    "/{file_library_id}/folders",
    response_model=LibraryFolderPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
        LibraryFolderAlreadyExistsError,
    ),
)
def create_folder(
    *,
    session: SessionDep,
    file_library_id: uuid.UUID,
    body: LibraryFolderCreate,
) -> LibraryFolderPublic:
    """创建文件库文件夹。"""
    folder = service.create_folder(
        session=session,
        file_library_id=file_library_id,
        folder_create=body,
    )

    return LibraryFolderPublic.model_validate(folder)


@router.get(
    "/{file_library_id}/folders",
    response_model=LibraryFoldersPublic,
    responses=error_responses(FileLibraryNotFoundError),
)
def read_folders(
    session: SessionDep,
    file_library_id: uuid.UUID,
) -> LibraryFoldersPublic:
    """查询文件库文件夹列表。"""
    folders = service.list_folders(
        session=session,
        file_library_id=file_library_id,
    )

    data: list[LibraryFolderPublic] = []

    for folder in folders:
        data.append(LibraryFolderPublic.model_validate(folder))

    return LibraryFoldersPublic(
        data=data,
        count=len(folders),
    )


@router.patch(
    "/{file_library_id}/folders/{folder_id}",
    response_model=LibraryFolderPublic,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
        LibraryFolderAlreadyExistsError,
    ),
)
def update_folder(
    *,
    session: SessionDep,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: LibraryFolderUpdate,
) -> LibraryFolderPublic:
    """重命名文件库文件夹。"""
    folder = service.update_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
        folder_update=body,
    )

    return LibraryFolderPublic.model_validate(folder)


@router.patch(
    "/{file_library_id}/folders/{folder_id}/parent",
    response_model=LibraryFolderPublic,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
        LibraryFolderInvalidParentError,
        LibraryFolderAlreadyExistsError,
    ),
)
def move_folder(
    *,
    session: SessionDep,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID,
    body: LibraryFolderMove,
) -> LibraryFolderPublic:
    """移动文件库文件夹。"""
    folder = service.move_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
        target_parent_id=body.parent_id,
    )

    return LibraryFolderPublic.model_validate(folder)


@router.get(
    "/{file_library_id}/entries",
    response_model=LibraryDirectoryPublic,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
    ),
)
def read_directory(
    session: SessionDep,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> LibraryDirectoryPublic:
    """查询文件库目录，文件夹优先排列。"""
    entries, count = service.list_directory(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
        skip=skip,
        limit=limit,
    )

    return LibraryDirectoryPublic(data=entries, count=count)


@router.post(
    "/{file_library_id}/directory/batch-delete",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
        LibraryDocumentNotFoundError,
    ),
)
def delete_directory_entries(
    session: SessionDep,
    file_library_id: uuid.UUID,
    body: LibraryDirectoryDelete,
) -> None:
    """批量删除文件库文件夹和文件。"""
    service.delete_directory_entries(
        session=session,
        file_library_id=file_library_id,
        folder_ids=body.folder_ids,
        document_ids=body.document_ids,
    )


@router.post(
    "/{file_library_id}/documents/uploads",
    response_model=LibraryDocumentUploadPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
        FileStorageUnavailableError,
    ),
)
def create_document_upload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    body: FileUploadRequest,
) -> LibraryDocumentUploadPublic:
    """创建文件库文件上传凭证。

    使用返回的 uploadUrl 和 uploadHeaders 通过 HTTP PUT 上传完整文件内容，
    然后调用 library_document_upload_complete 确认上传。
    """
    return service.create_document_upload(
        session=session,
        current_user=current_user,
        file_library_id=file_library_id,
        folder_id=folder_id,
        upload_request=body,
    )


@document_router.post(
    "/{document_id}/complete",
    response_model=LibraryDocumentPublic,
    responses=error_responses(
        LibraryDocumentNotFoundError,
        FileUploadIncompleteError,
        FileSizeMismatchError,
        FileStorageUnavailableError,
    ),
)
async def complete_document_upload(
    session: SessionDep,
    document_id: uuid.UUID,
) -> LibraryDocumentPublic:
    """确认文件库文件上传。

    仅在文件已通过 library_document_upload_create 返回的 uploadUrl 上传后调用。
    确认成功后，原文件可供下载。
    """
    return await documents.complete_upload(
        session=session,
        document_id=document_id,
    )


@document_router.get(
    "/{document_id}",
    response_model=LibraryDocumentPublic,
    responses=error_responses(LibraryDocumentNotFoundError),
)
def read_document(
    session: SessionDep,
    document_id: uuid.UUID,
) -> LibraryDocumentPublic:
    """根据 ID 获取指定文件库文件。"""
    return documents.get_document(session=session, document_id=document_id)


@document_router.get(
    "/{document_id}/download",
    response_model=FileCompletePublic,
    responses=error_responses(
        LibraryDocumentNotFoundError,
        FileUploadIncompleteError,
        FileStorageUnavailableError,
    ),
)
def download_original_document(
    session: SessionDep,
    document_id: uuid.UUID,
) -> FileCompletePublic:
    """获取文件库文件原文件下载地址。"""
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
    response_model=LibraryDocumentPublic,
    responses=error_responses(
        LibraryDocumentNotFoundError,
        FileLibraryNotFoundError,
        LibraryFolderNotFoundError,
    ),
)
def move_document(
    *,
    session: SessionDep,
    document_id: uuid.UUID,
    body: LibraryDocumentMove,
) -> LibraryDocumentPublic:
    """移动文件库文件。"""
    return service.move_document(
        session=session,
        document_id=document_id,
        folder_id=body.folder_id,
    )


@document_router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(LibraryDocumentNotFoundError),
)
def delete_document(session: SessionDep, document_id: uuid.UUID) -> None:
    """删除文件库文件。"""
    documents.delete_document(session=session, document_id=document_id)
