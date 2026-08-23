import asyncio
import uuid

from sqlmodel import Session, col, select

from app.modules.conversations.models import ConversationFile
from app.modules.files import document_parser, object_storage, validation
from app.modules.files.constants import (
    ALLOWED_CONTENT_TYPES,
    DOCUMENT_CONTENT_TYPES,
    DOCUMENT_FORMAT_BY_CONTENT_TYPE,
    FILE_HEADER_READ_BYTES,
    KNOWLEDGE_CONTENT_TYPES,
    TEXT_CONTENT_TYPES,
)
from app.modules.files.exceptions import (
    DocumentContentTooLargeError,
    DocumentParsingError,
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
from app.modules.files.models import StoredFile
from app.modules.files.schemas import FileUploadRequest
from app.modules.knowledge.models import KnowledgeDocument
from app.modules.users.models import User

MAX_TEXT_FILE_SIZE = 256 * 1024

FILE_REFERENCE_PREFIX = "file:"


def create_file_upload(
    *,
    session: Session,
    current_user: User,
    upload_request: FileUploadRequest,
) -> tuple[StoredFile, str]:
    # 创建待上传记录并返回对象存储直传地址。
    content_type = upload_request.content_type

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise FileTypeNotAllowedError
    if content_type in TEXT_CONTENT_TYPES and upload_request.size > MAX_TEXT_FILE_SIZE:
        raise TextFileTooLargeError

    file_id = uuid.uuid4()

    object_key = object_storage.create_object_key(
        owner_id=current_user.id,
        file_id=file_id,
    )

    stored_file = StoredFile(
        id=file_id,
        owner_id=current_user.id,
        object_key=object_key,
        filename=upload_request.filename,
        content_type=content_type,
        size=upload_request.size,
    )

    upload_url = object_storage.create_upload_url(
        object_key=object_key,
    )

    session.add(stored_file)

    session.commit()

    return stored_file, upload_url


async def complete_file_upload(
    *,
    session: Session,
    current_user: User,
    file_id: uuid.UUID,
) -> tuple[StoredFile, str]:
    stored_file = _get_file_for_owner(
        session=session,
        owner_id=current_user.id,
        file_id=file_id,
    )

    content_type = stored_file.content_type

    if stored_file.uploaded:
        return stored_file, object_storage.create_download_url(stored_file.object_key)

    object_metadata = await asyncio.to_thread(
        object_storage.head_object, stored_file.object_key
    )

    if int(object_metadata["Content-Length"]) != stored_file.size:
        await _delete_invalid_upload(session, stored_file)
        raise FileSizeMismatchError

    try:
        if content_type in TEXT_CONTENT_TYPES:
            file_content = await asyncio.to_thread(
                object_storage.read_object_bytes,
                object_key=stored_file.object_key,
                size=stored_file.size,
            )

            stored_file.extracted_text = validation.validate_text_content(
                file_content,
                content_type,
            )
        else:
            file_header = await asyncio.to_thread(
                object_storage.read_object_bytes,
                object_key=stored_file.object_key,
                size=min(FILE_HEADER_READ_BYTES, stored_file.size),
            )
            validation.validate_content_type_header(file_header, content_type)

            if content_type in DOCUMENT_CONTENT_TYPES:
                temporary_file = await asyncio.to_thread(
                    object_storage.download_to_temporary_file,
                    stored_file.object_key,
                )

                try:
                    stored_file.extracted_text = await document_parser.extract_markdown(
                        file=temporary_file,
                        filename=stored_file.filename,
                        document_format=DOCUMENT_FORMAT_BY_CONTENT_TYPE[content_type],
                    )
                finally:
                    temporary_file.close()
    except (
        DocumentContentTooLargeError,
        DocumentParsingError,
        FileContentTypeMismatchError,
        TextFileEncodingError,
    ):
        await _delete_invalid_upload(session, stored_file)
        raise

    stored_file.uploaded = True
    session.add(stored_file)
    session.commit()

    return stored_file, object_storage.create_download_url(stored_file.object_key)


def get_uploaded_file(
    *,
    session: Session,
    current_user: User,
    file_id: uuid.UUID,
) -> StoredFile:
    # 获取当前用户已完成上传的文件。
    return _get_uploaded_file_for_owner(
        session=session,
        owner_id=current_user.id,
        file_id=file_id,
    )


def resolve_file_reference(
    *,
    session: Session,
    user_id: uuid.UUID,
    reference: str,
) -> StoredFile:
    # 将聊天文件引用解析为当前用户的已上传文件。
    if not reference.startswith(FILE_REFERENCE_PREFIX):
        raise FileNotFoundError

    try:
        file_id = uuid.UUID(reference.removeprefix(FILE_REFERENCE_PREFIX))
    except ValueError:
        raise FileNotFoundError from None

    return _get_uploaded_file_for_owner(
        session=session,
        owner_id=user_id,
        file_id=file_id,
    )


def get_extracted_text(stored_file: StoredFile) -> str:
    # 获取可作为模型上下文的已提取文本。
    if stored_file.content_type not in KNOWLEDGE_CONTENT_TYPES:
        raise FileTypeNotAllowedError

    if stored_file.extracted_text is None:
        raise FileUploadIncompleteError

    return stored_file.extracted_text


def remove_unreferenced_file(
    *,
    session: Session,
    current_user: User,
    file_id: uuid.UUID,
) -> None:
    stored_file = _get_file_for_owner(
        session=session,
        owner_id=current_user.id,
        file_id=file_id,
    )
    object_key = stored_file.object_key

    conversation_reference = session.get(ConversationFile, stored_file.id)

    knowledge_reference = session.exec(
        select(KnowledgeDocument.id).where(
            col(KnowledgeDocument.stored_file_id) == stored_file.id
        )
    ).first()

    if conversation_reference is not None or knowledge_reference is not None:
        raise SentFileDeletionForbiddenError

    session.delete(stored_file)
    session.commit()
    cleanup_objects([object_key])


def delete_files(*, session: Session, file_ids: list[uuid.UUID]) -> None:
    # 批量删除文件记录及其对象存储内容。
    object_keys = delete_file_records(session=session, file_ids=file_ids)
    session.commit()
    cleanup_objects(object_keys)


def delete_file_records(*, session: Session, file_ids: list[uuid.UUID]) -> list[str]:
    # 删除文件记录并返回对应的对象存储路径。
    object_keys: list[str] = []

    for file_id in file_ids:
        stored_file = session.get(StoredFile, file_id)

        if stored_file is None:
            continue

        object_keys.append(stored_file.object_key)

        session.delete(stored_file)

    return object_keys


def _get_file_for_owner(
    *,
    session: Session,
    owner_id: uuid.UUID,
    file_id: uuid.UUID,
) -> StoredFile:
    # 按用户归属查询文件。
    statement = select(StoredFile).where(
        col(StoredFile.id) == file_id,
        col(StoredFile.owner_id) == owner_id,
    )

    stored_file = session.exec(statement).first()

    if stored_file is None:
        raise FileNotFoundError

    return stored_file


def _get_uploaded_file_for_owner(
    *, session: Session, owner_id: uuid.UUID, file_id: uuid.UUID
) -> StoredFile:
    # 按用户归属查询已完成上传的文件。
    stored_file = _get_file_for_owner(
        session=session,
        owner_id=owner_id,
        file_id=file_id,
    )

    if not stored_file.uploaded:
        raise FileUploadIncompleteError

    return stored_file


async def _delete_invalid_upload(session: Session, stored_file: StoredFile) -> None:
    object_key = stored_file.object_key

    session.delete(stored_file)
    session.commit()

    await asyncio.to_thread(cleanup_objects, [object_key])


def cleanup_objects(object_keys: list[str]) -> None:
    for object_key in object_keys:
        try:
            object_storage.delete_object(object_key)
        except FileStorageUnavailableError:
            continue
