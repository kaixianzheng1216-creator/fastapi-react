from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.db.timestamps import utc_now


class InfluencerAccountSnapshot(SQLModel, table=True):
    __tablename__ = "influencer_account_snapshot"

    id: int | None = Field(default=None, primary_key=True)
    captured_at: datetime = Field(
        default_factory=utc_now,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class InfluencerAccount(SQLModel, table=True):
    __tablename__ = "influencer_account"
    __table_args__ = (
        UniqueConstraint(
            "snapshot_id",
            "platform",
            "platform_uid",
            name="uq_influencer_account_snapshot_platform_uid",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    snapshot_id: int = Field(
        foreign_key="influencer_account_snapshot.id",
        ondelete="CASCADE",
    )
    platform: str = Field(max_length=20)
    platform_uid: str = Field(max_length=128)
    public_account_id: str = Field(max_length=100)
    nickname: str = Field(max_length=255)
    avatar_url: str | None = Field(default=None, max_length=500)
    profile_url: str = Field(max_length=500)
    location: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, sa_type=Text)
    followers: int = Field(sa_type=BigInteger)
    engagement_count: int | None = Field(default=None, sa_type=BigInteger)
