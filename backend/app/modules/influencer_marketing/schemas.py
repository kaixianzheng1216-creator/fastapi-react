from datetime import datetime
from enum import StrEnum

from sqlmodel import SQLModel


class InfluencerAccountSortBy(StrEnum):
    FOLLOWERS = "followers"
    ENGAGEMENT_COUNT = "engagement_count"


class InfluencerSortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


class InfluencerAccountPublic(SQLModel):
    public_account_id: str
    nickname: str
    avatar_url: str | None
    profile_url: str
    location: str | None
    bio: str | None
    followers: int
    engagement_count: int | None


class InfluencerAccountsPublic(SQLModel):
    captured_at: datetime | None
    data: list[InfluencerAccountPublic]
    count: int
