from sqlmodel import Session

from app.modules.items import service
from app.modules.items.models import Item
from app.modules.items.schemas import ItemCreate
from tests.support.data import random_lower_string
from tests.support.users import create_random_user


def create_random_item(db: Session) -> Item:
    user = create_random_user(db)
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    return service.create_item(session=db, current_user=user, item_create=item_in)
