from sqlmodel import SQLModel

from app.modules.items.models import Item  # noqa: F401
from app.modules.users.models import User  # noqa: F401

metadata = SQLModel.metadata
