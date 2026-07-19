import logging

from sqlalchemy import Engine
from sqlmodel import Session, select
from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed

from app.db.session import engine

MAX_TRIES = 60 * 5  # 5 minutes
WAIT_SECONDS = 1

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("正在初始化服务")
    wait_for_database(engine)
    logger.info("服务初始化完成")


@retry(
    stop=stop_after_attempt(MAX_TRIES),
    wait=wait_fixed(WAIT_SECONDS),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARNING),
)
def wait_for_database(db_engine: Engine) -> None:
    with Session(db_engine) as session:
        session.exec(select(1))


if __name__ == "__main__":
    main()
