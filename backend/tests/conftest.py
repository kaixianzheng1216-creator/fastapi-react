from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.dependencies import get_db
from app.bootstrap.initial_data import initialize_data
from app.core.config import settings
from app.db.session import engine
from app.main import app
from tests.support.data import get_superuser_token_headers
from tests.support.users import authentication_token_from_username


@pytest.fixture(autouse=True)
def db() -> Generator[Session]:
    with engine.connect() as connection:
        transaction = connection.begin()
        with Session(
            bind=connection, join_transaction_mode="create_savepoint"
        ) as session:
            initialize_data(session)
            app.dependency_overrides[get_db] = lambda: session
            try:
                yield session
            finally:
                app.dependency_overrides.pop(get_db, None)
        transaction.rollback()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_username(
        client=client, username=settings.TEST_USER_USERNAME, db=db
    )
