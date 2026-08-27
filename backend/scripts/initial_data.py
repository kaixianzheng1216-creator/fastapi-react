import logging

from app.bootstrap.initial_data import create_initial_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    create_initial_data()


if __name__ == "__main__":
    main()
