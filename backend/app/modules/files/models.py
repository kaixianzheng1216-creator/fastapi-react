import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Index, Text
from sqlmodel import Field, SQLModel


class StoredFile(SQLModel, table=True):
    __tablename__ = "stored_file"
    __table_args__ = (
        Index("ix_stored_file_owner_created_at", "owner_id", "created_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id",
        nullable=False,
        ondelete="CASCADE",
    )
    object_key: str = Field(max_length=500, unique=True)
    filename: str = Field(max_length=255)
    content_type: str = Field(max_length=255)
    size: int = Field(sa_type=BigInteger)
    uploaded: bool = Field(default=False, nullable=False)
    extracted_text: str | None = Field(default=None, sa_type=Text)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),  # type: ignore
        nullable=False,
    )
