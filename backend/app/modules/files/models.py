import uuid

from sqlalchemy import BigInteger, Text
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class StoredFile(TimestampMixin, table=True):
    __tablename__ = "stored_file"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id")
    object_key: str = Field(max_length=500, unique=True)
    filename: str = Field(max_length=255)
    content_type: str = Field(max_length=255)
    size: int = Field(sa_type=BigInteger)
    uploaded: bool = False
    extracted_text: str | None = Field(default=None, sa_type=Text)
