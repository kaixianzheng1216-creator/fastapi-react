from fastapi import APIRouter

from app.api.dependencies import SessionDep
from app.modules.users import service
from app.modules.users.schemas import PrivateUserCreate, UserPublic

router = APIRouter(tags=["private"], prefix="/private")


@router.post("/users/", response_model=UserPublic)
def create_user(user_in: PrivateUserCreate, session: SessionDep) -> UserPublic:
    """创建新用户。"""
    user = service.create_private_user(session=session, user_create=user_in)
    return UserPublic.model_validate(user)
