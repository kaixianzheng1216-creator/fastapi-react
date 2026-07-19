from sqlmodel import Session

from app.modules.items import service
from app.modules.items.models import Item
from app.modules.items.schemas import ItemCreate
from tests.support.data import random_lower_string
from tests.support.users import create_random_user


def create_random_item(db: Session) -> Item:
    user = create_random_user(db)
    owner_id = user.id
    assert owner_id is not None
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    return service.create_item_for_owner(
        session=db, item_create=item_in, owner_id=owner_id
    )
