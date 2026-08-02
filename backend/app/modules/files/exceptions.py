from fastapi import status

from app.common.exceptions import ApplicationError


class FileNotFoundError(ApplicationError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "文件不存在"


class FileUploadIncompleteError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "文件上传尚未完成"


class SentFileDeletionForbiddenError(ApplicationError):
    status_code = status.HTTP_409_CONFLICT
    detail = "已发送的文件不能删除"


class FileSizeMismatchError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "文件大小与上传请求不一致"


class FileContentTypeMismatchError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "文件类型与上传请求不一致"


class FileTypeNotAllowedError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "不支持该文件类型"


class FileStorageUnavailableError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "文件存储暂时不可用"


class TextFileTooLargeError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "文本附件不能超过 256KB"


class TextFileEncodingError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "文本附件必须使用 UTF-8 编码"


class DocumentParsingError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "无法解析该文档"


class DocumentParsingUnavailableError(ApplicationError):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "文档解析服务暂时不可用"


class DocumentContentTooLargeError(ApplicationError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "文档内容过长，暂时无法直接对话"
