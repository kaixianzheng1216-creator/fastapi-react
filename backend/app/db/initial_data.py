from sqlmodel import Session

from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.session import engine
from app.modules.users import service
from app.modules.users.schemas import UserCreate


def init_db(session: Session) -> None:
    user = service.get_user_by_email(session=session, email=settings.FIRST_SUPERUSER)
    if not user:
        service.create_user(
            session=session,
            user_create=UserCreate(
                email=settings.FIRST_SUPERUSER,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
            ),
        )


def create_initial_data() -> None:
    with Session(engine) as session:
        init_db(session)
