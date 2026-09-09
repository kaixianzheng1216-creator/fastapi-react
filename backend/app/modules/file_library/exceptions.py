from fastapi import status

from app.common.exceptions import ApplicationError


class FileLibraryAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "文件库名称已存在"


class FileLibraryNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "文件库不存在"


class LibraryFolderAlreadyExistsError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "文件夹名称已存在"


class LibraryFolderNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "文件夹不存在"


class LibraryFolderInvalidParentError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "不能将文件夹移动到自身或其子文件夹"


class LibraryDocumentNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "文件库文件不存在"
