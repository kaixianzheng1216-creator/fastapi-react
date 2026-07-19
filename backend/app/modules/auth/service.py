from datetime import UTC, datetime, timedelta

import jwt
from jwt.exceptions import InvalidTokenError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.integrations.email.service import (
    EmailData,
    generate_reset_password_email,
    send_email,
)
from app.modules.auth.exceptions import InactiveUserError, InvalidResetTokenError
from app.modules.users import service as users_service
from app.modules.users.exceptions import UserNotFoundError
from app.modules.users.models import User
from app.modules.users.schemas import UserUpdate

DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    user = users_service.get_user_by_email(session=session, email=email)
    if not user:
        security.verify_password(password, DUMMY_HASH)
        return None

    verified, updated_password_hash = security.verify_password(
        password, user.hashed_password
    )
    if not verified:
        return None

    if updated_password_hash:
        user.hashed_password = updated_password_hash
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def generate_password_reset_token(email: str) -> str:
    now = datetime.now(UTC)
    expires = now + timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"exp": expires.timestamp(), "nbf": now, "sub": email},
        settings.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )


def verify_password_reset_token(token: str) -> str | None:
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return str(decoded_token["sub"])
    except InvalidTokenError:
        return None


def recover_password(*, session: Session, email: str) -> None:
    user = users_service.get_user_by_email(session=session, email=email)
    if not user:
        return

    token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=token
    )
    send_email(
        email_to=user.email,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )


def reset_password(*, session: Session, token: str, new_password: str) -> None:
    email = verify_password_reset_token(token)
    if not email:
        raise InvalidResetTokenError

    user = users_service.get_user_by_email(session=session, email=email)
    if not user:
        raise InvalidResetTokenError
    if not user.is_active:
        raise InactiveUserError

    users_service.update_user(
        session=session,
        user=user,
        user_update=UserUpdate(password=new_password),
    )


def get_password_recovery_email(*, session: Session, email: str) -> EmailData:
    user = users_service.get_user_by_email(session=session, email=email)
    if not user:
        raise UserNotFoundError

    token = generate_password_reset_token(email=email)
    return generate_reset_password_email(
        email_to=user.email, email=email, token=token
    )
