from typing import Annotated, cast

from fastapi import Depends, Request, Response
from fastapi.security import APIKeyCookie

from app.api.dependencies import SessionDep
from app.core.config import settings
from app.modules.auth.client import AuthServerClient
from app.modules.auth.exceptions import InvalidOriginError
from app.modules.auth.service import get_session_user
from app.modules.auth.session import SESSION_COOKIE, SessionStore
from app.modules.users.exceptions import InsufficientPrivilegesError
from app.modules.users.models import User


def get_auth_client(request: Request) -> AuthServerClient:
    return cast(AuthServerClient, request.app.state.auth_client)


def get_session_store(request: Request) -> SessionStore:
    return cast(SessionStore, request.app.state.auth_sessions)


AuthClientDep = Annotated[AuthServerClient, Depends(get_auth_client)]
SessionStoreDep = Annotated[SessionStore, Depends(get_session_store)]
SessionCookieDep = Annotated[
    str | None, Depends(APIKeyCookie(name=SESSION_COOKIE, auto_error=False))
]


def require_trusted_origin(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return

    if request.headers.get("origin") != str(settings.APP_ORIGIN).rstrip("/"):
        raise InvalidOriginError


def get_current_user(
    response: Response,
    session: SessionDep,
    session_id: SessionCookieDep,
    store: SessionStoreDep,
    auth: AuthClientDep,
    _origin: Annotated[None, Depends(require_trusted_origin)],
) -> User:
    response.headers["Cache-Control"] = "no-store"

    return get_session_user(
        session_id=session_id, session=session, auth=auth, store=store
    )


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise InsufficientPrivilegesError

    return current_user


CurrentSuperuser = Annotated[User, Depends(get_current_active_superuser)]
