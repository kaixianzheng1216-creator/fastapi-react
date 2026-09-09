"""Run with `python -m scripts.check_file_library`; uses a temporary PostgreSQL schema."""

import asyncio
import importlib.util
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlmodel import Session, select

from app.api.dependencies import get_db
from app.api.exception_handlers import add_exception_handlers
from app.core.config import settings
from app.db.models import metadata
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.file_library import documents, service
from app.modules.file_library.exceptions import (
    LibraryFolderAlreadyExistsError,
    LibraryFolderInvalidParentError,
    LibraryFolderNotFoundError,
)
from app.modules.file_library.models import FileLibrary, LibraryDocument, LibraryFolder
from app.modules.file_library.router import document_router, router
from app.modules.file_library.schemas import FileLibraryCreate, LibraryFolderCreate
from app.modules.files.exceptions import (
    FileSizeMismatchError,
    FileStorageUnavailableError,
    FileUploadIncompleteError,
)
from app.modules.files.models import StoredFile
from app.modules.files.schemas import FileUploadRequest
from app.modules.users.models import User


def main() -> None:
    engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    schema = f"check_file_library_{uuid.uuid4().hex}"
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        with engine.connect() as connection:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            metadata.create_all(
                connection, tables=[User.__table__, StoredFile.__table__]
            )
            migration_path = (
                Path(__file__).parents[1] / "alembic/versions/0006_file_libraries.py"
            )
            specification = importlib.util.spec_from_file_location(
                "file_library_migration", migration_path
            )
            assert specification is not None and specification.loader is not None
            migration = importlib.util.module_from_spec(specification)
            specification.loader.exec_module(migration)
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
            connection.commit()
            with Session(connection) as session:
                check_storage_and_folders(session)
                check_access(session)
            with Operations.context(MigrationContext.configure(connection)):
                migration.downgrade()
            connection.commit()
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()


def check_storage_and_folders(session: Session) -> None:
    user = User(username="library-check", hashed_password="unused", is_superuser=True)
    session.add(user)
    session.commit()
    library = service.create_file_library(
        session=session, file_library_create=FileLibraryCreate(name="Library")
    )
    other = service.create_file_library(
        session=session, file_library_create=FileLibraryCreate(name="Other")
    )
    parent = service.create_folder(
        session=session,
        file_library_id=library.id,
        folder_create=LibraryFolderCreate(name="Parent"),
    )
    child = service.create_folder(
        session=session,
        file_library_id=library.id,
        folder_create=LibraryFolderCreate(name="Child", parent_id=parent.id),
    )
    foreign = service.create_folder(
        session=session,
        file_library_id=other.id,
        folder_create=LibraryFolderCreate(name="Foreign"),
    )
    with raises(LibraryFolderAlreadyExistsError):
        service.create_folder(
            session=session,
            file_library_id=library.id,
            folder_create=LibraryFolderCreate(name="Parent"),
        )
    with raises(LibraryFolderInvalidParentError):
        service.move_folder(
            session=session,
            file_library_id=library.id,
            folder_id=parent.id,
            target_parent_id=child.id,
        )
    with raises(LibraryFolderNotFoundError):
        service.move_folder(
            session=session,
            file_library_id=library.id,
            folder_id=parent.id,
            target_parent_id=foreign.id,
        )
    session.rollback()

    with (
        patch.object(
            documents.object_storage,
            "create_upload_url",
            return_value="https://storage.example/upload",
        ),
        patch.object(
            documents.object_storage,
            "head_object",
            return_value={"Content-Length": "4"},
        ),
        patch.object(documents.object_storage, "delete_objects") as delete_objects,
    ):
        upload = service.create_document_upload(
            session=session,
            current_user=user,
            file_library_id=library.id,
            folder_id=child.id,
            upload_request=FileUploadRequest(
                filename="archive.zip", contentType="application/zip", size=4
            ),
        )
        with raises(FileUploadIncompleteError):
            documents.get_original_file(session=session, document_id=upload.id)
        complete = asyncio.run(
            documents.complete_upload(session=session, document_id=upload.id)
        )
        assert complete.uploaded and complete.filename == "archive.zip"
        assert (
            asyncio.run(
                documents.complete_upload(session=session, document_id=upload.id)
            ).id
            == complete.id
        )
        stored = documents.get_original_file(session=session, document_id=upload.id)
        stored_id, object_key = stored.id, stored.object_key
        assert stored.extracted_text is None
        with raises(LibraryFolderNotFoundError):
            service.move_document(
                session=session, document_id=upload.id, folder_id=foreign.id
            )
        session.rollback()
        service.move_document(session=session, document_id=upload.id, folder_id=None)
        entries, count = service.list_directory(
            session=session, file_library_id=library.id, folder_id=None, skip=0, limit=1
        )
        assert count == 2 and entries[0].type == "folder"
        entries, count = service.list_directory(
            session=session, file_library_id=library.id, folder_id=None, skip=1, limit=1
        )
        assert count == 2 and entries[0].id == upload.id
        service.move_document(
            session=session, document_id=upload.id, folder_id=child.id
        )
        delete_objects.side_effect = FileStorageUnavailableError
        with raises(FileStorageUnavailableError):
            service.delete_directory_entries(
                session=session,
                file_library_id=library.id,
                folder_ids={parent.id},
                document_ids=set(),
            )
        session.rollback()
        assert session.get(StoredFile, stored_id) is not None
        assert session.get(LibraryDocument, upload.id) is not None
        delete_objects.side_effect = None
        child_id = child.id
        service.delete_directory_entries(
            session=session,
            file_library_id=library.id,
            folder_ids={parent.id},
            document_ids={upload.id},
        )
        session.expire_all()
        assert session.get(StoredFile, stored_id) is None
        assert session.get(LibraryFolder, child_id) is None
        delete_objects.assert_called_with([object_key])

        mismatch = service.create_document_upload(
            session=session,
            current_user=user,
            file_library_id=library.id,
            folder_id=None,
            upload_request=FileUploadRequest(
                filename="bad.bin", contentType="application/octet-stream", size=5
            ),
        )
        with raises(FileSizeMismatchError):
            asyncio.run(
                documents.complete_upload(session=session, document_id=mismatch.id)
            )
        assert session.get(LibraryDocument, mismatch.id) is None
        service.delete_file_library(session=session, file_library_id=library.id)
        service.delete_file_library(session=session, file_library_id=other.id)
        assert session.exec(select(FileLibrary)).all() == []
    with raises(ValidationError):
        LibraryFolderCreate(name="  ")
    with raises(ValidationError):
        FileUploadRequest(
            filename="empty", contentType="application/octet-stream", size=0
        )


def check_access(session: Session) -> None:
    app = FastAPI()
    add_exception_handlers(app)
    app.include_router(router)
    app.include_router(document_router)

    def database() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        assert client.get("/admin/file-libraries").status_code == 401
        assert (
            client.get(f"/admin/library-documents/{uuid.uuid4()}/download").status_code
            == 401
        )
        app.dependency_overrides[get_current_active_superuser] = lambda: User(
            username="admin", hashed_password="unused", is_superuser=True
        )
        assert client.get("/admin/file-libraries").status_code == 200
        assert (
            client.post("/admin/file-libraries", json={"name": " "}).status_code == 422
        )
        paths = app.openapi()["paths"]
        assert not any(
            term in path
            for path in paths
            for term in ("preview", "chunks", "retry", "search", "webpages")
        )


@contextmanager
def raises(exception_type: type[Exception]) -> Iterator[None]:
    try:
        yield
    except exception_type:
        return
    raise AssertionError(f"Expected {exception_type.__name__}")


if __name__ == "__main__":
    main()
