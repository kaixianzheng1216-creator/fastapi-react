from fastapi import APIRouter

from app.core.config import settings
from app.modules.auth.router import router as auth_router
from app.modules.items.router import router as items_router
from app.modules.system.router import router as system_router
from app.modules.users.private_router import router as private_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(system_router)
api_router.include_router(items_router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private_router)
