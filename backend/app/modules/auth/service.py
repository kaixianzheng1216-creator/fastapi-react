from datetime import timedelta

from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.modules.auth.exceptions import InactiveUserError, InvalidCredentialsError
from app.modules.users import service as users_service
from app.modules.users.models import User

DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, username: str, password: str) -> User:
    user = users_service.get_user_by_username(session=session, username=username)
    if not user:
        security.verify_password(password, DUMMY_HASH)
        raise InvalidCredentialsError

    verified, updated_password_hash = security.verify_password(
        password, user.hashed_password
    )
    if not verified:
        raise InvalidCredentialsError

    if updated_password_hash:
        user.hashed_password = updated_password_hash
        session.add(user)
        session.commit()
        session.refresh(user)

    if not user.is_active:
        raise InactiveUserError

    return user


def create_access_token_for_user(user: User) -> str:
    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    return security.create_access_token(user.id, expires_delta=expires)
