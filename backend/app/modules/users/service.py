import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.core.security import get_password_hash, verify_password
from app.modules.files import service as file_service
from app.modules.users.exceptions import (
    IncorrectPasswordError,
    InsufficientPrivilegesError,
    PasswordUnchangedError,
    SelfAdminStatusChangeForbiddenError,
    SelfDeletionForbiddenError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate, UserUpdate, UserUpdateMe


def create_unique_user(*, session: Session, user_create: UserCreate) -> User:
    if get_user_by_username(session=session, username=user_create.username):
        raise UserAlreadyExistsError

    return create_user(session=session, user_create=user_create)


def get_user_by_username(*, session: Session, username: str) -> User | None:
    statement = select(User).where(User.username == username)
    user = session.exec(statement).first()

    return user


def create_user(*, session: Session, user_create: UserCreate) -> User:
    user = User.model_validate(
        user_create,
        update={"hashed_password": get_password_hash(user_create.password)},
    )

    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def update_current_user(
    *, session: Session, current_user: User, user_update: UserUpdateMe
) -> User:
    if user_update.username:
        existing_user = get_user_by_username(
            session=session, username=user_update.username
        )
        if existing_user and existing_user.id != current_user.id:
            raise UserAlreadyExistsError

    current_user.sqlmodel_update(user_update.model_dump(exclude_unset=True))
    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return current_user


def update_current_password(
    *, session: Session, current_user: User, current_password: str, new_password: str
) -> None:
    verified, _ = verify_password(current_password, current_user.hashed_password)
    if not verified:
        raise IncorrectPasswordError
    if current_password == new_password:
        raise PasswordUnchangedError

    current_user.hashed_password = get_password_hash(new_password)
    session.add(current_user)
    session.commit()


def delete_current_user(*, session: Session, current_user: User) -> None:
    if current_user.is_superuser:
        raise SelfDeletionForbiddenError

    _delete_user(session=session, user=current_user)


def list_users(
    *,
    session: Session,
    skip: int,
    limit: int,
    search: str | None = None,
    is_superuser: bool | None = None,
    is_active: bool | None = None,
) -> tuple[Sequence[User], int]:
    filters: list[ColumnElement[bool]] = []

    if search and (query := search.strip()):
        filters.append(
            or_(
                col(User.username).icontains(query, autoescape=True),
                col(User.full_name).icontains(query, autoescape=True),
            )
        )

    if is_superuser is not None:
        filters.append(col(User.is_superuser) == is_superuser)

    if is_active is not None:
        filters.append(col(User.is_active) == is_active)

    count = session.exec(
        select(func.count()).select_from(User).where(*filters)
    ).one()

    statement = (
        select(User)
        .where(*filters)
        .order_by(col(User.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    users = session.exec(statement).all()

    return users, count


def get_user_for_request(
    *, session: Session, user_id: uuid.UUID, current_user: User
) -> User:
    user = session.get(User, user_id)

    if user == current_user:
        return current_user

    if not current_user.is_superuser:
        raise InsufficientPrivilegesError

    if user is None:
        raise UserNotFoundError

    return user


def update_user_by_id(
    *,
    session: Session,
    current_user: User,
    user_id: uuid.UUID,
    user_update: UserUpdate,
) -> User:
    user = session.get(User, user_id)

    if not user:
        raise UserNotFoundError

    if user == current_user and (
        user_update.is_active is False or user_update.is_superuser is False
    ):
        raise SelfAdminStatusChangeForbiddenError

    if user_update.username:
        existing_user = get_user_by_username(
            session=session, username=user_update.username
        )
        if existing_user and existing_user.id != user_id:
            raise UserAlreadyExistsError

    return update_user(session=session, user=user, user_update=user_update)


def update_user(*, session: Session, user: User, user_update: UserUpdate) -> User:
    user_data = user_update.model_dump(exclude_unset=True)
    extra_data: dict[str, Any] = {}
    if "password" in user_data:
        extra_data["hashed_password"] = get_password_hash(user_data["password"])

    user.sqlmodel_update(user_data, update=extra_data)
    session.add(user)
    session.commit()
    session.refresh(user)

    return user


def delete_user_by_id(
    *, session: Session, current_user: User, user_id: uuid.UUID
) -> None:
    user = session.get(User, user_id)

    if not user:
        raise UserNotFoundError

    if user == current_user:
        raise SelfDeletionForbiddenError

    _delete_user(session=session, user=user)


def _delete_user(*, session: Session, user: User) -> None:
    session.delete(user)
    session.flush()
    session.commit()

    object_keys = file_service.list_owner_object_keys(
        session=session,
        owner_id=user.id,
    )

    file_service.cleanup_objects(object_keys)
