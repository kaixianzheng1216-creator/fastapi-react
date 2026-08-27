from sqlmodel import Session

from app.modules.influencer_marketing.models import (
    InfluencerAccount,
    InfluencerAccountSnapshot,
)
from app.modules.influencer_marketing.source import fetch_influencer_accounts


def import_influencer_accounts(*, session: Session) -> int:
    """将本次采集结果保存为一个新快照。"""
    entries = fetch_influencer_accounts()

    snapshot = InfluencerAccountSnapshot()
    session.add(snapshot)
    session.flush()

    if snapshot.id is None:
        raise RuntimeError("达人资源快照保存失败")

    accounts: list[InfluencerAccount] = []

    for entry in entries:
        accounts.append(
            InfluencerAccount(
                snapshot_id=snapshot.id,
                platform=entry.platform.value,
                platform_uid=entry.platform_uid,
                public_account_id=entry.public_account_id,
                nickname=entry.nickname,
                avatar_url=entry.avatar_url,
                profile_url=entry.profile_url,
                location=entry.location,
                bio=entry.bio,
                followers=entry.followers,
                engagement_count=entry.engagement_count,
            )
        )

    session.add_all(accounts)
    session.commit()

    return len(accounts)
