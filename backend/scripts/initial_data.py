import logging

from app.bootstrap.initial_data import create_initial_data

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def main() -> None:
    logger.info("Creating initial data")
    create_initial_data()
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
