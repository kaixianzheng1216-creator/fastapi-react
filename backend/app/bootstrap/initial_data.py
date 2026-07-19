from sqlmodel import Session, select

from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.session import engine
from app.modules.users import service
from app.modules.users.models import User
from app.modules.users.schemas import UserCreate


def create_initial_data() -> None:
    with Session(engine) as session:
        initialize_data(session)


def initialize_data(session: Session) -> None:
    existing_superuser = session.exec(select(User).where(User.is_superuser)).first()

    if existing_superuser:
        return

    user = service.get_user_by_username(
        session=session, username=settings.FIRST_SUPERUSER_USERNAME
    )

    if not user:
        service.create_user(
            session=session,
            user_create=UserCreate(
                username=settings.FIRST_SUPERUSER_USERNAME,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
            ),
        )
