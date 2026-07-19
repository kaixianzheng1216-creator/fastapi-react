import logging

from app.bootstrap.initial_data import create_initial_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.info("正在创建初始数据")
    create_initial_data()
    logger.info("初始数据创建完成")


if __name__ == "__main__":
    main()
