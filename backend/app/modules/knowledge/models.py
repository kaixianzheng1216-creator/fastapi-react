import uuid
from enum import StrEnum

from sqlalchemy import String, Text
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class KnowledgeBase(TimestampMixin, table=True):
    __tablename__ = "knowledge_base"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    description: str | None = Field(default=None, max_length=500)
    is_enabled: bool = False


class KnowledgeDocumentStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    TIMED_OUT = "timed_out"


class KnowledgeDocument(TimestampMixin, table=True):
    __tablename__ = "knowledge_document"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(foreign_key="knowledge_base.id")
    stored_file_id: uuid.UUID = Field(foreign_key="stored_file.id", unique=True)
    source_url: str | None = Field(default=None, max_length=2083)
    status: KnowledgeDocumentStatus = Field(
        default=KnowledgeDocumentStatus.PENDING,
        sa_type=String(20),  # type: ignore
    )
    error_message: str | None = Field(default=None, sa_type=Text)
