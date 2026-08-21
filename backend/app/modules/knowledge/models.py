import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Text
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


class KnowledgeBase(SQLModel, table=True):
    __tablename__ = "knowledge_base"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(unique=True, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_enabled: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        nullable=False,
    )


class KnowledgeDocument(SQLModel, table=True):
    __tablename__ = "knowledge_document"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'processing', 'ready', 'failed', 'timed_out')",
            name="ck_knowledge_document_status",
        ),
        Index(
            "ix_knowledge_document_knowledge_base_created_at",
            "knowledge_base_id",
            "created_at",
        ),
        Index(
            "ix_knowledge_document_status_created_at",
            "status",
            "created_at",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(
        foreign_key="knowledge_base.id",
        nullable=False,
        ondelete="CASCADE",
    )
    stored_file_id: uuid.UUID = Field(
        foreign_key="stored_file.id",
        unique=True,
        nullable=False,
    )
    status: str = Field(default="pending", max_length=20, nullable=False)
    error_message: str | None = Field(default=None, sa_type=Text)
    processing_started_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        nullable=False,
    )
