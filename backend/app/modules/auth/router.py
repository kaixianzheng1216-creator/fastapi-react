from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse

from app.api.dependencies import SessionDep
from app.core.config import AUTH_PLATFORM, settings
from app.modules.auth.dependencies import (
    AuthClientDep,
    SessionCookieDep,
    SessionStoreDep,
    require_trusted_origin,
)
from app.modules.auth.schemas import TicketExchangeRequest
from app.modules.auth.service import login_with_ticket, logout_session
from app.modules.auth.session import SESSION_COOKIE
from app.modules.users.schemas import UserPublic

router = APIRouter(
    prefix="/auth", tags=["auth"], dependencies=[Depends(require_trusted_origin)]
)


@router.get("/dingtalk")
def login_dingtalk() -> RedirectResponse:
    """跳转到统一认证服务，发起钉钉登录。"""
    query = urlencode(
        {
            "platform": AUTH_PLATFORM,
            "return_url": f"{str(settings.APP_ORIGIN).rstrip('/')}/login",
        }
    )

    return RedirectResponse(
        f"{str(settings.AUTH_SERVER_URL).rstrip('/')}/api/user/login/dingtalk/authorize?{query}",
        status_code=302,
        headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
    )


@router.post("/dingtalk/exchange", response_model=UserPublic)
def exchange_ticket(
    body: TicketExchangeRequest,
    response: Response,
    session: SessionDep,
    auth: AuthClientDep,
    store: SessionStoreDep,
    session_id: SessionCookieDep,
) -> UserPublic:
    """兑换一次性登录凭证，建立会话并返回当前用户。"""
    user, new_id, ttl = login_with_ticket(
        ticket=body.ticket,
        previous_session_id=session_id,
        session=session,
        auth=auth,
        store=store,
    )

    response.set_cookie(
        SESSION_COOKIE,
        new_id,
        max_age=ttl,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        path="/",
    )

    response.headers["Cache-Control"] = "no-store"

    return UserPublic.model_validate(user)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    auth: AuthClientDep,
    store: SessionStoreDep,
    session_id: SessionCookieDep,
) -> None:
    """退出登录并清除浏览器会话 Cookie。"""
    logout_session(session_id=session_id, auth=auth, store=store)

    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        secure=settings.ENVIRONMENT == "production",
        httponly=True,
        samesite="lax",
    )

    response.headers["Cache-Control"] = "no-store"
