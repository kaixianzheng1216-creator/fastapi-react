import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum
from sqlmodel import Field, SQLModel

from app.db.timestamps import TimestampMixin, utc_now


class ProjectRole(StrEnum):
    ADMIN = "admin"
    MEMBER = "member"


class Project(TimestampMixin, table=True):
    __tablename__ = "project"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=100, unique=True)
    description: str | None = Field(default=None, max_length=500)


class ProjectMember(SQLModel, table=True):
    __tablename__ = "project_member"
    project_id: uuid.UUID = Field(
        foreign_key="project.id", ondelete="CASCADE", primary_key=True
    )
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    role: ProjectRole = Field(  # type: ignore[call-overload]
        default=ProjectRole.MEMBER,
        sa_type=Enum(
            ProjectRole,
            values_callable=lambda e: [v.value for v in e],
            native_enum=False,
            create_constraint=True,
            name="project_role",
        ),
    )
    created_at: datetime = Field(  # type: ignore[call-overload]
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),
    )
