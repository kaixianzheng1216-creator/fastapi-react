from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.modules.users.models import User
from tests.support.data import random_lower_string, random_username


def test_get_access_token(client: TestClient) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={
            "username": settings.FIRST_SUPERUSER_USERNAME,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_get_access_token_incorrect_password(client: TestClient) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={
            "username": settings.FIRST_SUPERUSER_USERNAME,
            "password": "incorrect",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Incorrect username or password"}


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    assert "username" in response.json()


def test_access_token_without_subject_is_rejected(client: TestClient) -> None:
    token = jwt.encode(
        {"exp": datetime.now(UTC) + timedelta(minutes=5)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )

    response = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Could not validate credentials"}


def test_login_with_bcrypt_password_upgrades_to_argon2(
    client: TestClient, db: Session
) -> None:
    username = random_username()
    password = random_lower_string()
    user = User(
        username=username,
        hashed_password=BcryptHasher().hash(password),
        is_active=True,
    )
    db.add(user)
    db.commit()

    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": username, "password": password},
    )

    assert response.status_code == 200
    db.refresh(user)
    assert user.hashed_password.startswith("$argon2")


def test_login_with_argon2_password_keeps_hash(client: TestClient, db: Session) -> None:
    username = random_username()
    password = random_lower_string()
    original_hash = get_password_hash(password)
    user = User(username=username, hashed_password=original_hash, is_active=True)
    db.add(user)
    db.commit()

    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": username, "password": password},
    )

    assert response.status_code == 200
    db.refresh(user)
    assert user.hashed_password == original_hash
    verified, updated_hash = verify_password(password, user.hashed_password)
    assert verified
    assert updated_hash is None
