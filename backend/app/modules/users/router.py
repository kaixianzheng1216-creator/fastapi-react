import uuid

from fastapi import APIRouter, Depends

from app.api.dependencies import SessionDep
from app.common.schemas import Message
from app.modules.auth.dependencies import (
    CurrentUser,
    get_current_active_superuser,
    get_current_user,
)
from app.modules.users import service
from app.modules.users.schemas import (
    UpdatePassword,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)

public_router = APIRouter(prefix="/users", tags=["users"])

authenticated_router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(get_current_user)],
)

admin_router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(get_current_active_superuser)],
)


@public_router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> UserPublic:
    """无需登录即可创建新用户。"""
    user = service.create_unique_user(
        session=session,
        user_create=UserCreate.model_validate(user_in),
    )

    return UserPublic.model_validate(user)


@authenticated_router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> UserPublic:
    """获取当前用户。"""
    return UserPublic.model_validate(current_user)


@authenticated_router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> UserPublic:
    """更新当前用户信息。"""
    user = service.update_current_user(
        session=session, current_user=current_user, user_update=user_in
    )

    return UserPublic.model_validate(user)


@authenticated_router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Message:
    """更新当前用户密码。"""
    service.update_current_password(
        session=session,
        current_user=current_user,
        current_password=body.current_password,
        new_password=body.new_password,
    )

    return Message(message="Password updated successfully")


@authenticated_router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Message:
    """删除当前用户。"""
    service.delete_current_user(session=session, current_user=current_user)

    return Message(message="User deleted successfully")


@admin_router.post("/", response_model=UserPublic)
def create_user(*, session: SessionDep, user_in: UserCreate) -> UserPublic:
    """创建新用户。"""
    user = service.create_unique_user(session=session, user_create=user_in)

    return UserPublic.model_validate(user)


@admin_router.get("/", response_model=UsersPublic)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> UsersPublic:
    """获取用户列表。"""
    users, count = service.list_users(session=session, skip=skip, limit=limit)
    public_users = [UserPublic.model_validate(user) for user in users]

    return UsersPublic(data=public_users, count=count)


@authenticated_router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> UserPublic:
    """根据 ID 获取指定用户。"""
    user = service.get_user_for_request(
        session=session, user_id=user_id, current_user=current_user
    )

    return UserPublic.model_validate(user)


@admin_router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    *, session: SessionDep, user_id: uuid.UUID, user_in: UserUpdate
) -> UserPublic:
    """更新用户。"""
    user = service.update_user_by_id(
        session=session, user_id=user_id, user_update=user_in
    )

    return UserPublic.model_validate(user)


@admin_router.delete("/{user_id}")
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """删除用户。"""
    service.delete_user_by_id(
        session=session, current_user=current_user, user_id=user_id
    )

    return Message(message="User deleted successfully")
