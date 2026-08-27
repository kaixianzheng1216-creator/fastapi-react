import logging

from sqlmodel import Session

from app.db.session import engine
from app.modules.influencer_marketing.importer import import_influencer_accounts

logger = logging.getLogger(__name__)


def main() -> None:
    with Session(engine) as session:
        count = import_influencer_accounts(session=session)

    logger.info("达人资源同步完成：导入 %s 条", count)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
