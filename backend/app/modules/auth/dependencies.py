from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError

from app.api.dependencies import SessionDep
from app.core import security
from app.core.config import settings
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.auth.schemas import TokenPayload
from app.modules.users.exceptions import InsufficientPrivilegesError
from app.modules.users.models import User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)
TokenDep = Annotated[str | None, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    if token is None:
        raise CredentialsValidationError
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except InvalidTokenError, ValidationError:
        raise CredentialsValidationError from None

    user = session.get(User, token_data.sub)
    if not user:
        raise CredentialsValidationError
    if not user.is_active:
        raise InactiveUserError
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise InsufficientPrivilegesError
    return current_user
