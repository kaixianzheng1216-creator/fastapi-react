import logging
import shutil
import tempfile
import uuid
from typing import IO, Any
from urllib.parse import quote

from qcloud_cos import CosConfig, CosS3Client  # type: ignore[import-untyped]
from qcloud_cos.cos_exception import (  # type: ignore[import-untyped]
    CosClientError,
    CosServiceError,
)

from app.core.config import settings
from app.modules.files.exceptions import FileStorageUnavailableError

FILE_OBJECT_PREFIX = "files"
UPLOAD_URL_LIFETIME_SECONDS = 15 * 60
DOWNLOAD_URL_LIFETIME_SECONDS = 60 * 60
DOCUMENT_SPOOL_MEMORY_LIMIT = 1024 * 1024
OBJECT_DELETE_BATCH_SIZE = 1000
UPLOAD_HEADERS = {"x-cos-forbid-overwrite": "true"}
OBJECT_DELETE_ERROR_LOG = "删除存储文件对象失败"

cos_client = CosS3Client(
    CosConfig(
        Region=settings.COS_REGION,
        SecretId=settings.COS_SECRET_ID.get_secret_value(),
        SecretKey=settings.COS_SECRET_KEY.get_secret_value(),
    )
)
logger = logging.getLogger(__name__)


def create_object_key(*, owner_id: uuid.UUID, file_id: uuid.UUID) -> str:
    return f"{FILE_OBJECT_PREFIX}/{owner_id}/{file_id.hex}"


def is_owner_object_key(*, object_key: str, owner_id: uuid.UUID) -> bool:
    return object_key.startswith(f"{FILE_OBJECT_PREFIX}/{owner_id}/")


def create_upload_url(*, object_key: str) -> str:
    return str(
        cos_client.get_presigned_url(
            Bucket=settings.COS_BUCKET,
            Key=object_key,
            Method="PUT",
            Expired=UPLOAD_URL_LIFETIME_SECONDS,
            Headers=UPLOAD_HEADERS,
        )
    )


def create_download_url(object_key: str, filename: str | None = None) -> str:
    params: dict[str, str] = {}

    if filename:
        encoded_filename = quote(filename)

        params["response-content-disposition"] = (
            f"attachment; filename*=UTF-8''{encoded_filename}"
        )

    return str(
        cos_client.get_presigned_url(
            Bucket=settings.COS_BUCKET,
            Key=object_key,
            Method="GET",
            Expired=DOWNLOAD_URL_LIFETIME_SECONDS,
            Params=params,
        )
    )


def head_object(object_key: str) -> dict[str, Any]:
    try:
        response: dict[str, Any] = cos_client.head_object(
            Bucket=settings.COS_BUCKET,
            Key=object_key,
        )

        return response
    except CosServiceError as error:
        if error.get_status_code() == 404:
            raise FileNotFoundError(object_key) from None

        raise FileStorageUnavailableError from error
    except CosClientError as error:
        raise FileStorageUnavailableError from error


def read_object_bytes(*, object_key: str, size: int | None = None) -> bytes:
    response = _get_object(object_key=object_key, size=size)

    body = response["Body"]

    try:
        return b"".join(body.get_stream())
    finally:
        body.get_raw_stream().close()


def write_object_content(
    *,
    object_key: str,
    content: bytes,
    content_type: str | None = None,
) -> None:
    params: dict[str, Any] = {
        "Bucket": settings.COS_BUCKET,
        "Key": object_key,
        "Body": content,
    }

    if content_type is not None:
        params["ContentType"] = content_type

    try:
        cos_client.put_object(**params)
    except (CosClientError, CosServiceError) as error:
        raise FileStorageUnavailableError from error


def list_object_keys(prefix: str) -> list[str]:
    object_keys: list[str] = []
    marker = ""

    try:
        while True:
            response: dict[str, Any] = cos_client.list_objects(
                Bucket=settings.COS_BUCKET,
                Prefix=prefix,
                Marker=marker,
            )

            for item in response.get("Contents", []):
                object_keys.append(item["Key"])

            if response.get("IsTruncated") != "true":
                return object_keys

            marker = response["NextMarker"]
    except (CosClientError, CosServiceError, KeyError) as error:
        raise FileStorageUnavailableError from error


def download_to_temporary_file(object_key: str) -> IO[bytes]:
    response = _get_object(object_key=object_key)

    raw_stream = response["Body"].get_raw_stream()

    temporary_file = tempfile.SpooledTemporaryFile(max_size=DOCUMENT_SPOOL_MEMORY_LIMIT)

    try:
        shutil.copyfileobj(raw_stream, temporary_file)

        temporary_file.seek(0)

        return temporary_file
    except (CosClientError, OSError) as error:
        temporary_file.close()

        raise FileStorageUnavailableError from error
    finally:
        raw_stream.close()


def delete_objects(object_keys: list[str]) -> None:
    for start_index in range(0, len(object_keys), OBJECT_DELETE_BATCH_SIZE):
        batch = object_keys[start_index : start_index + OBJECT_DELETE_BATCH_SIZE]
        objects_to_delete: list[dict[str, str]] = []

        for object_key in batch:
            objects_to_delete.append({"Key": object_key})

        try:
            response: dict[str, Any] = cos_client.delete_objects(
                Bucket=settings.COS_BUCKET,
                Delete={
                    "Quiet": "true",
                    "Object": objects_to_delete,
                },
            )
        except (CosClientError, CosServiceError) as error:
            logger.exception(
                OBJECT_DELETE_ERROR_LOG,
                extra={"object_count": len(batch)},
            )

            raise FileStorageUnavailableError from error

        failed_objects = response.get("Error", [])

        if failed_objects:
            logger.error(
                OBJECT_DELETE_ERROR_LOG,
                extra={"failed_object_count": len(failed_objects)},
            )

            raise FileStorageUnavailableError


def _get_object(*, object_key: str, size: int | None = None) -> Any:
    try:
        if size is None:
            return cos_client.get_object(
                Bucket=settings.COS_BUCKET,
                Key=object_key,
            )

        return cos_client.get_object(
            Bucket=settings.COS_BUCKET,
            Key=object_key,
            Range=f"bytes=0-{size - 1}",
        )
    except CosServiceError as error:
        if error.get_status_code() == 404:
            raise FileNotFoundError(object_key) from None

        raise FileStorageUnavailableError from error
    except CosClientError as error:
        raise FileStorageUnavailableError from error
