import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import SessionDep
from app.common.schemas import Message
from app.core.config import settings
from app.integrations.email.service import generate_new_account_email, send_email
from app.modules.auth.dependencies import CurrentUser, get_current_active_superuser
from app.modules.users import service
from app.modules.users.exceptions import (
    IncorrectPasswordError,
    InsufficientPrivilegesError,
    PasswordUnchangedError,
    SelfDeletionForbiddenError,
    UserAlreadyExistsError,
    UserNotFoundError,
)
from app.modules.users.schemas import (
    UpdatePassword,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> UsersPublic:
    """获取用户列表。"""
    users, count = service.list_users(session=session, skip=skip, limit=limit)
    return UsersPublic(
        data=[UserPublic.model_validate(user) for user in users], count=count
    )


@router.post(
    "/", dependencies=[Depends(get_current_active_superuser)], response_model=UserPublic
)
def create_user(*, session: SessionDep, user_in: UserCreate) -> UserPublic:
    """创建新用户。"""
    try:
        user = service.create_unique_user(session=session, user_create=user_in)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email,
            username=user_in.email,
            password=user_in.password,
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return UserPublic.model_validate(user)


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> UserPublic:
    """更新当前用户信息。"""
    try:
        user = service.update_current_user(
            session=session, current_user=current_user, user_update=user_in
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=409, detail="User with this email already exists"
        )
    return UserPublic.model_validate(user)


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Message:
    """更新当前用户密码。"""
    try:
        service.update_current_password(
            session=session,
            current_user=current_user,
            current_password=body.current_password,
            new_password=body.new_password,
        )
    except IncorrectPasswordError:
        raise HTTPException(status_code=400, detail="Incorrect password")
    except PasswordUnchangedError:
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the current one",
        )
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> UserPublic:
    """获取当前用户。"""
    return UserPublic.model_validate(current_user)


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Message:
    """删除当前用户。"""
    try:
        service.delete_current_user(session=session, current_user=current_user)
    except SelfDeletionForbiddenError:
        raise HTTPException(
            status_code=403,
            detail="Super users are not allowed to delete themselves",
        )
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> UserPublic:
    """无需登录即可创建新用户。"""
    try:
        user = service.create_unique_user(
            session=session,
            user_create=UserCreate.model_validate(user_in),
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    return UserPublic.model_validate(user)


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> UserPublic:
    """根据 ID 获取指定用户。"""
    try:
        user = service.get_user_for_request(
            session=session, user_id=user_id, current_user=current_user
        )
    except InsufficientPrivilegesError:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic.model_validate(user)


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *, session: SessionDep, user_id: uuid.UUID, user_in: UserUpdate
) -> UserPublic:
    """更新用户。"""
    try:
        user = service.update_user_by_id(
            session=session, user_id=user_id, user_update=user_in
        )
    except UserNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=409, detail="User with this email already exists"
        )
    return UserPublic.model_validate(user)


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """删除用户。"""
    try:
        service.delete_user_by_id(
            session=session, current_user=current_user, user_id=user_id
        )
    except UserNotFoundError:
        raise HTTPException(status_code=404, detail="User not found")
    except SelfDeletionForbiddenError:
        raise HTTPException(
            status_code=403,
            detail="Super users are not allowed to delete themselves",
        )
    return Message(message="User deleted successfully")
