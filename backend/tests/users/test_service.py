from fastapi.encoders import jsonable_encoder
from sqlmodel import Session

from app.core.security import verify_password
from app.modules.users import service as users_service
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate
from tests.support.data import random_lower_string, random_username


def test_create_user(db: Session) -> None:
    username = random_username()
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(username=username, password=random_lower_string()),
    )

    assert user.username == username
    assert hasattr(user, "hashed_password")


def test_user_is_active_by_default(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(), password=random_lower_string()
        ),
    )

    assert user.is_active is True


def test_create_inactive_user(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(),
            password=random_lower_string(),
            is_active=False,
        ),
    )

    assert user.is_active is False


def test_create_superuser(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(),
            password=random_lower_string(),
            is_superuser=True,
        ),
    )

    assert user.is_superuser is True


def test_normal_user_is_not_superuser(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(), password=random_lower_string()
        ),
    )

    assert user.is_superuser is False


def test_get_user(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(),
            password=random_lower_string(),
            is_superuser=True,
        ),
    )

    stored_user = db.get(User, user.id)

    assert stored_user
    assert jsonable_encoder(user) == jsonable_encoder(stored_user)


def test_update_user_password(db: Session) -> None:
    user = users_service.create_user(
        session=db,
        user_create=UserCreate(
            username=random_username(),
            password=random_lower_string(),
            is_superuser=True,
        ),
    )
    new_password = random_lower_string()

    users_service.update_user(
        session=db,
        user=user,
        user_update=UserUpdate(password=new_password, is_superuser=True),
    )
    stored_user = db.get(User, user.id)

    assert stored_user
    verified, _ = verify_password(new_password, stored_user.hashed_password)
    assert verified
