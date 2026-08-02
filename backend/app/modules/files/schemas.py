import uuid
from pathlib import PurePosixPath

from pydantic import BaseModel, Field, field_validator

MAX_FILE_SIZE = 100 * 1024 * 1024


class FileUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(alias="contentType", min_length=1, max_length=255)
    size: int = Field(gt=0, le=MAX_FILE_SIZE)

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
