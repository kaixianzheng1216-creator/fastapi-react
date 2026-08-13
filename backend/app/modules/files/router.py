import uuid

from fastapi import APIRouter, status

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.files import object_storage, service
from app.modules.files.exceptions import (
    DocumentContentTooLargeError,
    DocumentParsingError,
    DocumentParsingUnavailableError,
    FileContentTypeMismatchError,
    FileNotFoundError,
    FileSizeMismatchError,
    FileStorageUnavailableError,
    FileTypeNotAllowedError,
    FileUploadIncompleteError,
    SentFileDeletionForbiddenError,
    TextFileEncodingError,
    TextFileTooLargeError,
)
from app.modules.files.schemas import (
    FileCompletePublic,
    FileUploadPublic,
    FileUploadRequest,
)

router = APIRouter(
    prefix="/files",
    tags=["files"],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
    ),
)


@router.post(
    "",
    response_model=FileUploadPublic,
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(
        FileTypeNotAllowedError,
        TextFileTooLargeError,
        FileStorageUnavailableError,
    ),
)
def create_file_upload(
    session: SessionDep,
    current_user: CurrentUser,
    body: FileUploadRequest,
) -> FileUploadPublic:
    """创建文件上传凭证。"""
    stored_file, upload_url = service.create_file_upload(
        session=session,
        current_user=current_user,
        upload_request=body,
    )

    return FileUploadPublic(
        id=stored_file.id,
        upload_url=upload_url,
        upload_headers=object_storage.UPLOAD_HEADERS,
    )


@router.post(
    "/{file_id}/complete",
    response_model=FileCompletePublic,
    responses=error_responses(
        FileNotFoundError,
        FileSizeMismatchError,
        FileContentTypeMismatchError,
        TextFileEncodingError,
        DocumentParsingError,
        DocumentContentTooLargeError,
        DocumentParsingUnavailableError,
        FileStorageUnavailableError,
    ),
)
async def complete_file_upload(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: uuid.UUID,
) -> FileCompletePublic:
    """确认文件上传。"""
    stored_file, download_url = await service.complete_file_upload(
        session=session,
        current_user=current_user,
        file_id=file_id,
    )

    return FileCompletePublic(id=stored_file.id, download_url=download_url)


@router.get(
    "/{file_id}",
    response_model=FileCompletePublic,
    responses=error_responses(
        FileNotFoundError,
        FileUploadIncompleteError,
    ),
)
def get_file_download_url(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: uuid.UUID,
) -> FileCompletePublic:
    """获取文件下载地址。"""
    stored_file = service.get_uploaded_file(
        session=session,
        current_user=current_user,
        file_id=file_id,
    )

    return FileCompletePublic(
        id=stored_file.id,
        download_url=object_storage.create_download_url(stored_file.object_key),
    )


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(
        FileNotFoundError,
        SentFileDeletionForbiddenError,
        FileStorageUnavailableError,
    ),
)
def delete_unreferenced_file(
    session: SessionDep,
    current_user: CurrentUser,
    file_id: uuid.UUID,
) -> None:
    """删除未关联文件。"""
    service.remove_unreferenced_file(
        session=session,
        current_user=current_user,
        file_id=file_id,
    )
