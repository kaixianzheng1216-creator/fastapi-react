import uuid
from collections.abc import Sequence

from sqlmodel import Session, col, func, select

from app.modules.items.exceptions import ItemNotFoundError, ItemPermissionError
from app.modules.items.models import Item
from app.modules.items.schemas import ItemCreate, ItemUpdate
from app.modules.users.models import User


def create_item(
    *, session: Session, current_user: User, item_create: ItemCreate
) -> Item:
    item = Item.model_validate(item_create, update={"owner_id": current_user.id})

    session.add(item)
    session.commit()
    session.refresh(item)

    return item


def list_items(
    *, session: Session, current_user: User, skip: int, limit: int
) -> tuple[Sequence[Item], int]:
    count_statement = select(func.count()).select_from(Item)
    statement = select(Item).order_by(col(Item.created_at).desc())

    if not current_user.is_superuser:
        count_statement = count_statement.where(Item.owner_id == current_user.id)
        statement = statement.where(Item.owner_id == current_user.id)

    count = session.exec(count_statement).one()
    items = session.exec(statement.offset(skip).limit(limit)).all()

    return items, count


def get_accessible_item(
    *, session: Session, current_user: User, item_id: uuid.UUID
) -> Item:
    item = session.get(Item, item_id)

    if not item:
        raise ItemNotFoundError

    if not current_user.is_superuser and item.owner_id != current_user.id:
        raise ItemPermissionError

    return item


def update_item(
    *,
    session: Session,
    current_user: User,
    item_id: uuid.UUID,
    item_update: ItemUpdate,
) -> Item:
    item = get_accessible_item(
        session=session, current_user=current_user, item_id=item_id
    )

    item.sqlmodel_update(item_update.model_dump(exclude_unset=True))
    session.add(item)
    session.commit()
    session.refresh(item)

    return item


def delete_item(*, session: Session, current_user: User, item_id: uuid.UUID) -> None:
    item = get_accessible_item(
        session=session, current_user=current_user, item_id=item_id
    )

    session.delete(item)
    session.commit()
