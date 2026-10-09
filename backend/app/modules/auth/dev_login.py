"""仅本地开发使用的固定普通用户。"""

import time

from sqlmodel import Session

from app.core.config import settings
from app.modules.auth.exceptions import InvalidSessionError
from app.modules.auth.schemas import AuthUser, LoginSession
from app.modules.auth.session import SessionStore
from app.modules.users.models import User
from app.modules.users.service import get_or_create_auth_user

DEV_AUTH_USER_ID = "__local_dev_user__"
DEV_ACCESS_TOKEN = "__local_dev_session__"


def is_dev_session(login: LoginSession) -> bool:
    return (
        login.auth_user_id == DEV_AUTH_USER_ID
        and login.access_token == DEV_ACCESS_TOKEN
    )


def create_dev_session(
    session: Session, store: SessionStore, previous_session_id: str | None
) -> tuple[User, str, int]:
    if not settings.DEV_LOGIN_ENABLED:
        raise InvalidSessionError

    user = get_or_create_auth_user(
        session=session,
        identity=AuthUser(id=DEV_AUTH_USER_ID, name="本地测试用户"),
    )

    session_id, ttl = store.create(
        LoginSession(
            user_id=user.id,
            auth_user_id=DEV_AUTH_USER_ID,
            access_token=DEV_ACCESS_TOKEN,
            expires_at=int(time.time()) + 86400,
        )
    )

    store.delete(previous_session_id)

    return user, session_id, ttl
