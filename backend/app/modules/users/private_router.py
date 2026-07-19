from fastapi import APIRouter, HTTPException

from app.api.dependencies import SessionDep
from app.modules.users import service
from app.modules.users.exceptions import UserAlreadyExistsError
from app.modules.users.schemas import PrivateUserCreate, UserPublic

router = APIRouter(tags=["private"], prefix="/private")


@router.post("/users/", response_model=UserPublic)
def create_user(user_in: PrivateUserCreate, session: SessionDep) -> UserPublic:
    """创建新用户。"""
    try:
        user = service.create_private_user(session=session, user_create=user_in)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    return UserPublic.model_validate(user)
