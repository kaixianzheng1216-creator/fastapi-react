import uuid
from pathlib import PurePosixPath

from pydantic import BaseModel, Field, field_validator

MAX_FILE_SIZE = 100 * 1024 * 1024


class FileUploadRequest(BaseModel):
    filename: str = Field(
        min_length=1,
        max_length=255,
        description="包含扩展名的文件名，例如 report.pdf",
    )
    content_type: str = Field(
        alias="contentType",
        min_length=1,
        max_length=255,
        description="文件 MIME 类型，例如 application/pdf",
    )
    size: int = Field(
        gt=0,
        le=MAX_FILE_SIZE,
        description="文件字节数，必须与实际上传内容长度一致",
    )

    @field_validator("filename")
    @classmethod
    def normalize_filename(cls, filename: str) -> str:
        normalized = PurePosixPath(filename.replace("\\", "/")).name

        if not normalized:
            raise ValueError("文件名无效")

        return normalized


class FileUploadPublic(BaseModel):
    id: uuid.UUID
    upload_url: str = Field(serialization_alias="uploadUrl")
    upload_headers: dict[str, str] = Field(serialization_alias="uploadHeaders")


class FileCompletePublic(BaseModel):
    id: uuid.UUID
    download_url: str = Field(serialization_alias="downloadUrl")
