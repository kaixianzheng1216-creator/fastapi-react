import uuid
from enum import StrEnum

from sqlalchemy import ForeignKeyConstraint, String, Text, UniqueConstraint
from sqlmodel import Field

from app.db.timestamps import TimestampMixin


class KnowledgeBase(TimestampMixin, table=True):
    __tablename__ = "knowledge_base"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    description: str | None = Field(default=None, max_length=500)
    is_enabled: bool = False


class KnowledgeFolder(TimestampMixin, table=True):
    __tablename__ = "knowledge_folder"
    __table_args__ = (
        ForeignKeyConstraint(
            ["knowledge_base_id", "parent_id"],
            ["knowledge_folder.knowledge_base_id", "knowledge_folder.id"],
            name="fk_knowledge_folder_parent",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "knowledge_base_id",
            "id",
            name="uq_knowledge_folder_knowledge_base_id_id",
        ),
        UniqueConstraint(
            "knowledge_base_id",
            "parent_id",
            "name",
            name="uq_knowledge_folder_parent_name",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(
        foreign_key="knowledge_base.id",
        ondelete="CASCADE",
    )
    parent_id: uuid.UUID | None = None
    name: str = Field(max_length=100)


class KnowledgeDocumentStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"
    TIMED_OUT = "timed_out"


class KnowledgeDocument(TimestampMixin, table=True):
    __tablename__ = "knowledge_document"
    __table_args__ = (
        ForeignKeyConstraint(
            ["knowledge_base_id", "folder_id"],
            ["knowledge_folder.knowledge_base_id", "knowledge_folder.id"],
            name="fk_knowledge_document_folder",
            ondelete="CASCADE",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    knowledge_base_id: uuid.UUID = Field(
        foreign_key="knowledge_base.id",
        ondelete="CASCADE",
    )
    folder_id: uuid.UUID | None = None
    stored_file_id: uuid.UUID = Field(
        foreign_key="stored_file.id",
        unique=True,
    )
    source_url: str | None = Field(default=None, max_length=2083)
    status: KnowledgeDocumentStatus = Field(
        default=KnowledgeDocumentStatus.PENDING,
        sa_type=String(20),  # type: ignore
    )
    error_message: str | None = Field(default=None, sa_type=Text)
