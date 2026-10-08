import uuid
from collections.abc import Sequence

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.db.timestamps import utc_now
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.auth.schemas import AuthUser
from app.modules.users.exceptions import (
    InsufficientPrivilegesError,
    SelfAdminStatusChangeForbiddenError,
    SelfDeletionForbiddenError,
    UserNotFoundError,
)
from app.modules.users.models import User
from app.modules.users.schemas import UserUpdate


def get_or_create_auth_user(*, session: Session, identity: AuthUser) -> User:
    statement = select(User).where(User.auth_user_id == identity.id)

    user = session.exec(statement).one_or_none()

    if user is None:
        user = User(
            auth_user_id=identity.id,
            username=f"user_{uuid.uuid4().hex}",
            full_name=identity.name,
        )

        session.add(user)

        try:
            session.commit()
        except IntegrityError:
            session.rollback()

            user = session.exec(statement).one_or_none()

            if user is None:
                raise

    if user.deleted_at is not None:
        raise CredentialsValidationError

    if not user.is_active:
        raise InactiveUserError

    if user.full_name != identity.name:
        user.full_name = identity.name

        session.add(user)

        session.commit()

    session.refresh(user)

    return user


def list_users(
    *,
    session: Session,
    skip: int,
    limit: int,
    search: str | None = None,
    is_superuser: bool | None = None,
    is_active: bool | None = None,
) -> tuple[Sequence[User], int]:
    filters: list[ColumnElement[bool]] = [col(User.deleted_at).is_(None)]

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

    count = session.exec(select(func.count()).select_from(User).where(*filters)).one()

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
    if user_id == current_user.id:
        return current_user
    if not current_user.is_superuser:
        raise InsufficientPrivilegesError
    return _get_user(session=session, user_id=user_id)


def update_user_by_id(
    *, session: Session, current_user: User, user_id: uuid.UUID, user_update: UserUpdate
) -> User:
    user = _get_user(session=session, user_id=user_id)
    if user.id == current_user.id and (
        user_update.is_active is False or user_update.is_superuser is False
    ):
        raise SelfAdminStatusChangeForbiddenError

    user.sqlmodel_update(user_update.model_dump(exclude_none=True))
    session.add(user)
    session.commit()

    session.refresh(user)
    return user


def delete_user_by_id(
    *, session: Session, current_user: User, user_id: uuid.UUID
) -> None:
    user = _get_user(session=session, user_id=user_id)
    if user.id == current_user.id:
        raise SelfDeletionForbiddenError

    _soft_delete_user(session=session, user=user)


def _get_user(*, session: Session, user_id: uuid.UUID) -> User:
    user = session.exec(
        select(User).where(
            col(User.id) == user_id,
            col(User.deleted_at).is_(None),
        )
    ).one_or_none()

    if user is None:
        raise UserNotFoundError

    return user


def _soft_delete_user(*, session: Session, user: User) -> None:
    user.deleted_at = utc_now()
    session.add(user)
    session.commit()
