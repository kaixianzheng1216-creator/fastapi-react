import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import SessionDep
from app.common.schemas import Message
from app.modules.auth.dependencies import CurrentUser, get_current_user
from app.modules.items import service
from app.modules.items.schemas import ItemCreate, ItemPublic, ItemsPublic, ItemUpdate

router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/", response_model=ItemPublic)
def create_item(
    *, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate
) -> ItemPublic:
    """创建新物品。"""
    item = service.create_item(
        session=session, current_user=current_user, item_create=item_in
    )

    return ItemPublic.model_validate(item)


@router.get("/", response_model=ItemsPublic)
def read_items(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> ItemsPublic:
    """获取物品列表。"""
    items, count = service.list_items(
        session=session, current_user=current_user, skip=skip, limit=limit
    )
    public_items = [ItemPublic.model_validate(item) for item in items]

    return ItemsPublic(data=public_items, count=count)


@router.get("/{id}", response_model=ItemPublic)
def read_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> ItemPublic:
    """根据 ID 获取物品。"""
    item = service.get_accessible_item(
        session=session, current_user=current_user, item_id=id
    )

    return ItemPublic.model_validate(item)


@router.put("/{id}", response_model=ItemPublic)
def update_item(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    item_in: ItemUpdate,
) -> ItemPublic:
    """更新物品。"""
    item = service.update_item(
        session=session,
        current_user=current_user,
        item_id=id,
        item_update=item_in,
    )

    return ItemPublic.model_validate(item)


@router.delete("/{id}")
def delete_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """删除物品。"""
    service.delete_item(session=session, current_user=current_user, item_id=id)

    return Message(message="Item deleted successfully")
