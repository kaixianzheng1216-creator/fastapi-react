import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel

from app.modules.users.models import UserBase


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool | None = None
    is_superuser: bool | None = None


class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int
