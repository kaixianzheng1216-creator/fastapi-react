from redis import Redis
from sqlmodel import Session

from app.core.config import settings
from app.db.session import engine
from app.modules.agent.task_queue import celery_app
from app.modules.brand_marketing.importer import import_regional_data
from app.modules.content_operations.importer import import_bilibili_rankings
from app.modules.data_refresh.schemas import RefreshSource
from app.modules.influencer_marketing.importer import import_influencer_accounts


@celery_app.task(  # type: ignore[untyped-decorator]
    name="data.refresh",
    ignore_result=False,
    acks_late=False,
    soft_time_limit=1680,
    time_limit=1740,
)
def refresh_data(source_value: str) -> None:
    source = RefreshSource(source_value)

    with Redis.from_url(
        settings.REDIS_URL, socket_connect_timeout=3, socket_timeout=5
    ) as client:
        with client.lock(
            f"data-refresh:{source.value}:lock", timeout=1800, blocking_timeout=0
        ):
            with Session(engine) as session:
                match source:
                    case RefreshSource.REGIONAL:
                        import_regional_data(session=session)

                    case RefreshSource.RANKINGS:
                        import_bilibili_rankings(session=session)

                    case RefreshSource.INFLUENCERS:
                        import_influencer_accounts(session=session)
