import uuid
from collections.abc import Sequence

from psycopg.errors import UniqueViolation
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, delete, func, select

from app.modules.file_library import documents
from app.modules.file_library.exceptions import (
    FileLibraryAlreadyExistsError,
    FileLibraryNotFoundError,
    LibraryDocumentNotFoundError,
    LibraryFolderAlreadyExistsError,
    LibraryFolderInvalidParentError,
    LibraryFolderNotFoundError,
)
from app.modules.file_library.models import (
    FileLibrary,
    LibraryDocument,
    LibraryFolder,
)
from app.modules.file_library.schemas import (
    FileLibraryCreate,
    FileLibraryUpdate,
    LibraryDirectoryEntryPublic,
    LibraryDocumentEntryPublic,
    LibraryDocumentPublic,
    LibraryDocumentUploadPublic,
    LibraryFolderCreate,
    LibraryFolderEntryPublic,
    LibraryFolderUpdate,
)
from app.modules.files.models import StoredFile
from app.modules.files.schemas import FileUploadRequest
from app.modules.users.models import User


def list_file_libraries(
    *,
    session: Session,
    skip: int,
    limit: int,
    search: str | None = None,
) -> tuple[Sequence[FileLibrary], int]:
    filters: list[ColumnElement[bool]] = []

    if search:
        filters.append(col(FileLibrary.name).icontains(search.strip(), autoescape=True))

    count = session.exec(
        select(func.count()).select_from(FileLibrary).where(*filters)
    ).one()

    statement = (
        select(FileLibrary)
        .where(*filters)
        .order_by(col(FileLibrary.created_at).desc())
        .offset(skip)
        .limit(limit)
    )

    return session.exec(statement).all(), count


def get_file_library(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    for_update: bool = False,
) -> FileLibrary:
    statement = select(FileLibrary).where(col(FileLibrary.id) == file_library_id)

    if for_update:
        statement = statement.with_for_update()

    file_library = session.exec(statement).first()

    if file_library is None:
        raise FileLibraryNotFoundError

    return file_library


def create_file_library(
    *, session: Session, file_library_create: FileLibraryCreate
) -> FileLibrary:
    file_library = FileLibrary.model_validate(file_library_create)

    session.add(file_library)

    _commit(session)

    session.refresh(file_library)

    return file_library


def update_file_library(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    file_library_update: FileLibraryUpdate,
) -> FileLibrary:
    file_library = get_file_library(
        session=session,
        file_library_id=file_library_id,
    )

    file_library.sqlmodel_update(file_library_update.model_dump(exclude_unset=True))

    _commit(session)

    session.refresh(file_library)

    return file_library


def delete_file_library(*, session: Session, file_library_id: uuid.UUID) -> None:
    file_library = get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    documents.delete_file_library_documents(
        session=session,
        file_library_id=file_library_id,
    )

    session.delete(file_library)

    session.commit()


def list_directory(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    skip: int,
    limit: int,
) -> tuple[list[LibraryDirectoryEntryPublic], int]:
    """分页获取当前目录，文件夹始终排在文件前。"""
    get_file_library(session=session, file_library_id=file_library_id)

    _validate_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
    )

    folder_conditions = (
        col(LibraryFolder.file_library_id) == file_library_id,
        col(LibraryFolder.parent_id) == folder_id,
    )

    document_conditions = (
        col(LibraryDocument.file_library_id) == file_library_id,
        col(LibraryDocument.folder_id) == folder_id,
    )

    folder_count = session.exec(
        select(func.count()).select_from(LibraryFolder).where(*folder_conditions)
    ).one()

    document_count = session.exec(
        select(func.count()).select_from(LibraryDocument).where(*document_conditions)
    ).one()

    entries: list[LibraryDirectoryEntryPublic] = []

    if skip < folder_count:
        folder_rows = session.exec(
            select(LibraryFolder)
            .where(*folder_conditions)
            .order_by(col(LibraryFolder.name), col(LibraryFolder.id))
            .offset(skip)
            .limit(limit)
        ).all()

        for folder in folder_rows:
            entries.append(
                LibraryFolderEntryPublic.model_validate(
                    folder,
                    update={"type": "folder"},
                )
            )

    document_skip = max(skip - folder_count, 0)

    document_limit = limit - len(entries)

    if document_limit > 0:
        document_statement = (
            select(LibraryDocument, StoredFile)
            .join(
                StoredFile,
                col(StoredFile.id) == LibraryDocument.stored_file_id,
            )
            .where(*document_conditions)
            .order_by(
                col(LibraryDocument.created_at).desc(),
                col(LibraryDocument.id).desc(),
            )
            .offset(document_skip)
            .limit(document_limit)
        )

        document_rows = session.exec(document_statement).all()

        for document, stored_file in document_rows:
            entries.append(
                LibraryDocumentEntryPublic.model_validate(
                    documents.to_public(document, stored_file),
                    update={"type": "document"},
                )
            )

    return entries, folder_count + document_count


def list_folders(
    *, session: Session, file_library_id: uuid.UUID
) -> Sequence[LibraryFolder]:
    get_file_library(session=session, file_library_id=file_library_id)

    return session.exec(
        select(LibraryFolder)
        .where(col(LibraryFolder.file_library_id) == file_library_id)
        .order_by(col(LibraryFolder.name), col(LibraryFolder.id))
    ).all()


def create_folder(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_create: LibraryFolderCreate,
) -> LibraryFolder:
    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    _validate_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_create.parent_id,
    )

    folder = LibraryFolder(
        file_library_id=file_library_id,
        parent_id=folder_create.parent_id,
        name=folder_create.name,
    )

    session.add(folder)

    _commit_folder(session)

    session.refresh(folder)

    return folder


def update_folder(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID,
    folder_update: LibraryFolderUpdate,
) -> LibraryFolder:
    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    folder = _get_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
    )

    folder.name = folder_update.name

    _commit_folder(session)

    session.refresh(folder)

    return folder


def move_folder(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID,
    target_parent_id: uuid.UUID | None,
) -> LibraryFolder:
    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    folders = session.exec(
        select(LibraryFolder).where(
            col(LibraryFolder.file_library_id) == file_library_id
        )
    ).all()

    folders_by_id: dict[uuid.UUID, LibraryFolder] = {}

    for folder in folders:
        folders_by_id[folder.id] = folder

    folder_to_move = folders_by_id.get(folder_id)

    if folder_to_move is None or (
        target_parent_id is not None and target_parent_id not in folders_by_id
    ):
        raise LibraryFolderNotFoundError

    ancestor_id = target_parent_id

    while ancestor_id is not None:
        if ancestor_id == folder_id:
            raise LibraryFolderInvalidParentError

        ancestor_id = folders_by_id[ancestor_id].parent_id

    folder_to_move.parent_id = target_parent_id

    _commit_folder(session)

    session.refresh(folder_to_move)

    return folder_to_move


def create_document_upload(
    *,
    session: Session,
    current_user: User,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None,
    upload_request: FileUploadRequest,
) -> LibraryDocumentUploadPublic:
    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    _validate_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
    )

    return documents.create_upload(
        session=session,
        current_user=current_user,
        file_library_id=file_library_id,
        folder_id=folder_id,
        upload_request=upload_request,
    )


def move_document(
    *,
    session: Session,
    document_id: uuid.UUID,
    folder_id: uuid.UUID | None,
) -> LibraryDocumentPublic:
    file_library_id = session.exec(
        select(LibraryDocument.file_library_id).where(
            col(LibraryDocument.id) == document_id
        )
    ).first()

    if file_library_id is None:
        raise LibraryDocumentNotFoundError

    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    document = session.get(LibraryDocument, document_id, with_for_update=True)

    if document is None:
        raise LibraryDocumentNotFoundError

    _validate_folder(
        session=session,
        file_library_id=file_library_id,
        folder_id=folder_id,
    )

    document.folder_id = folder_id

    session.commit()

    return documents.get_document(session=session, document_id=document_id)


def delete_directory_entries(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_ids: set[uuid.UUID],
    document_ids: set[uuid.UUID],
) -> None:
    get_file_library(
        session=session,
        file_library_id=file_library_id,
        for_update=True,
    )

    affected_folder_ids: set[uuid.UUID] = set()

    if folder_ids:
        all_folders = session.exec(
            select(LibraryFolder).where(
                col(LibraryFolder.file_library_id) == file_library_id
            )
        ).all()

        folders_by_id: dict[uuid.UUID, LibraryFolder] = {}

        for folder in all_folders:
            folders_by_id[folder.id] = folder

        if not folder_ids.issubset(folders_by_id):
            raise LibraryFolderNotFoundError

        for folder in all_folders:
            ancestor_id: uuid.UUID | None = folder.id

            while ancestor_id is not None:
                if ancestor_id in folder_ids:
                    affected_folder_ids.add(folder.id)
                    break

                ancestor_id = folders_by_id[ancestor_id].parent_id

    documents_with_files = session.exec(
        select(LibraryDocument, StoredFile)
        .join(
            StoredFile,
            col(StoredFile.id) == LibraryDocument.stored_file_id,
        )
        .where(
            col(LibraryDocument.file_library_id) == file_library_id,
            or_(
                col(LibraryDocument.id).in_(document_ids),
                col(LibraryDocument.folder_id).in_(affected_folder_ids),
            ),
        )
        .with_for_update()
    ).all()

    existing_document_ids: set[uuid.UUID] = set()

    for document, _ in documents_with_files:
        existing_document_ids.add(document.id)

    if not document_ids.issubset(existing_document_ids):
        raise LibraryDocumentNotFoundError

    documents.delete_document_records(
        session,
        documents_with_files,
    )

    if folder_ids:
        session.exec(
            delete(LibraryFolder).where(
                col(LibraryFolder.file_library_id) == file_library_id,
                col(LibraryFolder.id).in_(folder_ids),
            )
        )

    session.commit()


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, UniqueViolation):
            raise FileLibraryAlreadyExistsError from error

        raise


def _get_folder(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID,
) -> LibraryFolder:
    folder = session.exec(
        select(LibraryFolder).where(
            col(LibraryFolder.id) == folder_id,
            col(LibraryFolder.file_library_id) == file_library_id,
        )
    ).first()

    if folder is None:
        raise LibraryFolderNotFoundError

    return folder


def _validate_folder(
    *,
    session: Session,
    file_library_id: uuid.UUID,
    folder_id: uuid.UUID | None,
) -> None:
    if folder_id is not None:
        _get_folder(
            session=session,
            file_library_id=file_library_id,
            folder_id=folder_id,
        )


def _commit_folder(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, UniqueViolation):
            raise LibraryFolderAlreadyExistsError from error

        raise
