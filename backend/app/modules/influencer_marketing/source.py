from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import httpx
from pydantic import BaseModel, HttpUrl, NonNegativeInt

from app.modules.influencer_marketing.constants import (
    PLATFORM_SOURCE_CODES,
    InfluencerPlatformCode,
)

INFLUENCER_RESOURCES_URL = "https://middle.kocloop.gbotai.cn/api/resources"
INFLUENCER_RESOURCES_PAGE_SIZE = 200


class _InfluencerAccountSource(BaseModel):
    platform: Literal["抖音", "小红书"]
    platform_uid: str
    public_account_id: str
    nickname: str
    avatar_url: HttpUrl | None = None
    profile_url: HttpUrl
    ip_location: str
    bio: str
    followers: NonNegativeInt
    engagement_count: NonNegativeInt | None = None
    last_seen_at: datetime


class _InfluencerResourcesResponse(BaseModel):
    total: NonNegativeInt
    accounts: list[_InfluencerAccountSource]


@dataclass(frozen=True, slots=True)
class InfluencerAccountEntry:
    platform: InfluencerPlatformCode
    platform_uid: str
    public_account_id: str
    nickname: str
    avatar_url: str | None
    profile_url: str
    location: str | None
    bio: str | None
    followers: int
    engagement_count: int | None


def fetch_influencer_accounts() -> list[InfluencerAccountEntry]:
    accounts: dict[
        tuple[InfluencerPlatformCode, str],
        tuple[datetime, InfluencerAccountEntry],
    ] = {}

    with httpx.Client(timeout=30) as client:
        offset = 0
        total = 1

        while offset < total:
            response = client.get(
                INFLUENCER_RESOURCES_URL,
                params={
                    "limit": INFLUENCER_RESOURCES_PAGE_SIZE,
                    "offset": offset,
                },
            )
            response.raise_for_status()

            source = _InfluencerResourcesResponse.model_validate(response.json())
            total = source.total

            if not source.accounts and offset < total:
                raise RuntimeError("达人资源分页提前结束")

            for item in source.accounts:
                entry = _normalize_account(item)
                key = (entry.platform, entry.platform_uid)
                current = accounts.get(key)

                if current is None or item.last_seen_at >= current[0]:
                    accounts[key] = (item.last_seen_at, entry)

            offset += len(source.accounts)

    return [entry for _, entry in accounts.values()]


def _normalize_account(source: _InfluencerAccountSource) -> InfluencerAccountEntry:
    location = source.ip_location.strip()

    return InfluencerAccountEntry(
        platform=PLATFORM_SOURCE_CODES[source.platform],
        platform_uid=source.platform_uid.strip(),
        public_account_id=source.public_account_id.strip(),
        nickname=" ".join(source.nickname.split()),
        avatar_url=str(source.avatar_url) if source.avatar_url is not None else None,
        profile_url=str(source.profile_url),
        location=None if location == "待识别" else location,
        bio=" ".join(source.bio.split()) or None,
        followers=source.followers,
        engagement_count=source.engagement_count,
    )
