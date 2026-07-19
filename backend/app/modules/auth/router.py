from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import SessionDep
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.schemas import Token
from app.modules.users.schemas import UserPublic

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """OAuth2 兼容的令牌登录，获取访问令牌用于后续请求"""
    user = service.authenticate(
        session=session, username=form_data.username, password=form_data.password
    )

    return Token(access_token=service.create_access_token_for_user(user))


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> UserPublic:
    """测试访问令牌"""
    return UserPublic.model_validate(current_user)
