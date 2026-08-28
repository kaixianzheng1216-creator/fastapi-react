import base64
import re
import uuid

from docling_core.types.doc.document import DoclingDocument
from pydantic import AnyUrl

from app.modules.files import object_storage
from app.modules.files.service import cleanup_objects

IMAGE_OBJECT_PREFIX = "knowledge/{document_id}/images/"
IMAGE_REFERENCE_PREFIX = "https://knowledge-images.invalid/"
IMAGE_NAME_PATTERN = re.compile(r"picture-\d+\.(?:png|jpg|gif|webp)")
IMAGE_REFERENCE_PATTERN = re.compile(
    re.escape(IMAGE_REFERENCE_PREFIX) + rf"(?P<image_name>{IMAGE_NAME_PATTERN.pattern})"
)
IMAGE_EXTENSION_BY_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}


class DocumentImageError(Exception):
    pass


def store_embedded_images(
    *,
    document_id: uuid.UUID,
    document: DoclingDocument,
) -> None:
    """将 Docling 内嵌图片保存到 COS，并改写为稳定引用。"""
    uploaded_object_keys: list[str] = []

    try:
        for image_index, picture in enumerate(document.pictures, start=1):
            image = picture.image

            if image is None:
                continue

            image_uri = str(image.uri)
            extension = IMAGE_EXTENSION_BY_CONTENT_TYPE.get(image.mimetype)

            if extension is None:
                raise DocumentImageError(f"不支持的图片格式：{image.mimetype}")

            image_name = f"picture-{image_index:04d}.{extension}"

            object_key = _image_object_key(document_id, image_name)

            object_storage.write_object_content(
                object_key=object_key,
                content=_decode_embedded_image(
                    image_uri=image_uri,
                    content_type=image.mimetype,
                ),
                content_type=image.mimetype,
            )

            uploaded_object_keys.append(object_key)

            picture.image = image.model_copy(
                update={"uri": AnyUrl(f"{IMAGE_REFERENCE_PREFIX}{image_name}")}
            )
    except Exception:
        cleanup_objects(uploaded_object_keys)
        raise


def resolve_markdown_image_urls(*, document_id: uuid.UUID, markdown: str) -> str:
    """在返回预览时为私有 COS 图片生成短期签名 URL。"""

    def replace_reference(match: re.Match[str]) -> str:
        return object_storage.create_download_url(
            _image_object_key(document_id, match.group("image_name"))
        )

    return IMAGE_REFERENCE_PATTERN.sub(replace_reference, markdown)


def list_image_object_keys(document_id: uuid.UUID) -> list[str]:
    return object_storage.list_object_keys(
        IMAGE_OBJECT_PREFIX.format(document_id=document_id)
    )


def image_name_from_reference(reference: str) -> str:
    match = IMAGE_REFERENCE_PATTERN.fullmatch(reference)

    if match is None:
        raise DocumentImageError("Docling 图片引用无效")

    return match.group("image_name")


def create_image_download_url(document_id: uuid.UUID, image_name: str) -> str:
    return object_storage.create_download_url(
        _image_object_key(document_id, image_name)
    )


def _image_object_key(document_id: uuid.UUID, image_name: str) -> str:
    if IMAGE_NAME_PATTERN.fullmatch(image_name) is None:
        raise DocumentImageError("图片名称无效")

    prefix = IMAGE_OBJECT_PREFIX.format(document_id=document_id)

    return f"{prefix}{image_name}"


def _decode_embedded_image(*, image_uri: str, content_type: str) -> bytes:
    expected_prefix = f"data:{content_type};base64,"

    if not image_uri.startswith(expected_prefix):
        raise DocumentImageError("Docling 图片不是内嵌图片")

    try:
        return base64.b64decode(
            image_uri.removeprefix(expected_prefix),
            validate=True,
        )
    except ValueError as error:
        raise DocumentImageError("Docling 图片内容无效") from error
