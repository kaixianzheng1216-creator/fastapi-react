import time

from sqlmodel import Session

from app.modules.auth.client import AuthServerClient
from app.modules.auth.exceptions import (
    AuthUnavailableError,
    InactiveSessionError,
    InvalidSessionError,
)
from app.modules.auth.schemas import LoginSession
from app.modules.auth.session import SessionStore
from app.modules.users.models import User
from app.modules.users.service import get_or_create_auth_user


def login_with_ticket(
    *,
    ticket: str,
    previous_session_id: str | None,
    session: Session,
    auth: AuthServerClient,
    store: SessionStore,
) -> tuple[User, str, int]:
    """兑换登录凭证并替换会话，返回用户、会话 ID 和有效秒数。"""
    started_at = int(time.time())

    tokens = auth.exchange(ticket)

    user = get_or_create_auth_user(session=session, identity=tokens.user)

    session_id, ttl = store.create(
        LoginSession(
            user_id=user.id,
            auth_user_id=tokens.user.id,
            access_token=tokens.access_token,
            expires_at=started_at + tokens.expires_in,
        )
    )

    store.delete(previous_session_id)

    return user, session_id, ttl


def get_session_user(
    *,
    session_id: str | None,
    session: Session,
    auth: AuthServerClient,
    store: SessionStore,
) -> User:
    """验证已有会话及本地用户状态，返回当前用户。"""
    login = store.read(session_id)

    if login is None:
        raise InvalidSessionError

    identity = auth.verify(login.access_token)

    expired = identity.expires_at <= int(time.time())

    if identity.user_id != login.auth_user_id or expired:
        store.delete(session_id)

        raise InvalidSessionError

    user = session.get(User, login.user_id)

    if (
        user is None
        or user.deleted_at is not None
        or user.auth_user_id != identity.user_id
    ):
        store.delete(session_id)

        raise InvalidSessionError

    if not user.is_active:
        store.delete(session_id)

        raise InactiveSessionError

    return user


def logout_session(
    *, session_id: str | None, auth: AuthServerClient, store: SessionStore
) -> None:
    """删除本地会话，并通知认证服务退出。"""
    login = store.read(session_id)

    store.delete(session_id)

    if login is None:
        return

    try:
        auth.logout(login.access_token)
    except AuthUnavailableError:
        pass
