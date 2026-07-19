from pwdlib.hashers.bcrypt import BcryptHasher
from sqlmodel import Session

from app.core.security import verify_password
from app.modules.auth import service as auth_service
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate
from app.modules.users.service import create_user
from tests.support.data import random_lower_string, random_username


def test_authenticate_user(db: Session) -> None:
    username = random_username()
    password = random_lower_string()
    user = create_user(
        session=db,
        user_create=UserCreate(username=username, password=password),
    )

    authenticated_user = auth_service.authenticate(
        session=db, username=username, password=password
    )

    assert authenticated_user
    assert user.username == authenticated_user.username


def test_unknown_user_is_not_authenticated(db: Session) -> None:
    user = auth_service.authenticate(
        session=db,
        username=random_username(),
        password=random_lower_string(),
    )

    assert user is None


def test_authentication_upgrades_bcrypt_to_argon2(db: Session) -> None:
    username = random_username()
    password = random_lower_string()
    user = User(username=username, hashed_password=BcryptHasher().hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)

    authenticated_user = auth_service.authenticate(
        session=db, username=username, password=password
    )

    assert authenticated_user
    db.refresh(authenticated_user)
    assert authenticated_user.hashed_password.startswith("$argon2")
    verified, updated_hash = verify_password(
        password, authenticated_user.hashed_password
    )
    assert verified
    assert updated_hash is None
