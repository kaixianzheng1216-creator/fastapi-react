from sqlmodel import Session, select

from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.session import engine
from app.modules.brand_marketing.importer import import_regional_data
from app.modules.brand_marketing.models import ProvinceAnnualIndicator
from app.modules.users import service
from app.modules.users.schemas import UserCreate


def create_initial_data() -> None:
    with Session(engine) as session:
        initialize_data(session)


def initialize_data(session: Session) -> None:
    user = service.get_user_by_username(
        session=session,
        username=settings.FIRST_SUPERUSER_USERNAME,
    )

    if user is None:
        service.create_user(
            session=session,
            user_create=UserCreate(
                username=settings.FIRST_SUPERUSER_USERNAME,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
            ),
        )

    regional_data_id = session.exec(
        select(ProvinceAnnualIndicator.id).limit(1)
    ).first()

    if regional_data_id is None:
        import_regional_data(session)
