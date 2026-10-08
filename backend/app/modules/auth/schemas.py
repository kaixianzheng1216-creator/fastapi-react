import uuid
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field

AuthUserId = Annotated[
    str,
    BeforeValidator(lambda value: str(value) if type(value) is int else value),
    Field(min_length=1, max_length=255),
]


class TicketExchangeRequest(BaseModel):
    ticket: str = Field(min_length=1, max_length=2048, repr=False)


class AuthUser(BaseModel):
    id: AuthUserId
    name: str = Field(max_length=255)


class TokenExchange(BaseModel):
    access_token: str = Field(min_length=1, repr=False)
    expires_in: int = Field(gt=0)
    user: AuthUser


class VerifiedIdentity(BaseModel):
    user_id: AuthUserId
    expires_at: int


class LoginSession(BaseModel):
    user_id: uuid.UUID
    auth_user_id: str
    access_token: str = Field(repr=False)
    expires_at: int
