from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import SessionDep
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.auth.schemas import Token
from app.modules.users.schemas import UserPublic

public_router = APIRouter(tags=["login"])

authenticated_router = APIRouter(
    tags=["login"], dependencies=[Depends(get_current_user)]
)


@public_router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """OAuth2 兼容的令牌登录，获取访问令牌用于后续请求"""
    access_token = service.login(
        session=session, username=form_data.username, password=form_data.password
    )

    return Token(access_token=access_token)


@authenticated_router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> UserPublic:
    """测试访问令牌"""
    return UserPublic.model_validate(current_user)
