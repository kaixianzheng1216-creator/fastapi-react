from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import SessionDep
from app.common.schemas import Message
from app.core import security
from app.core.config import settings
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser, get_current_active_superuser
from app.modules.auth.exceptions import InactiveUserError, InvalidResetTokenError
from app.modules.auth.schemas import NewPassword, Token
from app.modules.users.exceptions import UserNotFoundError
from app.modules.users.schemas import UserPublic

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """OAuth2 兼容的令牌登录，获取访问令牌用于后续请求"""
    user = service.authenticate(
        session=session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(user.id, expires_delta=expires)
    )


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> UserPublic:
    """测试访问令牌"""
    return UserPublic.model_validate(current_user)


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    """密码找回"""
    service.recover_password(session=session, email=email)
    return Message(
        message="If that email is registered, we sent a password recovery link"
    )


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """重置密码"""
    try:
        service.reset_password(
            session=session, token=body.token, new_password=body.new_password
        )
    except InvalidResetTokenError:
        raise HTTPException(status_code=400, detail="Invalid token")
    except InactiveUserError:
        raise HTTPException(status_code=400, detail="Inactive user")
    return Message(message="Password updated successfully")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(
    email: str, session: SessionDep
) -> HTMLResponse:
    """密码找回的 HTML 内容"""
    try:
        email_data = service.get_password_recovery_email(
            session=session, email=email
        )
    except UserNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )
