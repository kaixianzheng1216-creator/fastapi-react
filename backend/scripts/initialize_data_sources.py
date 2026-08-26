from sqlmodel import Session

from app.db.session import engine
from app.modules.brand_marketing.importer import import_regional_data
from app.modules.content_operations.importer import import_bilibili_rankings


def main() -> None:
    with Session(engine) as session:
        import_regional_data(session=session)
        import_bilibili_rankings(session=session)


if __name__ == "__main__":
    main()
