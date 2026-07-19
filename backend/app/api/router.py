from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.items.router import router as items_router
from app.modules.system.router import router as system_router
from app.modules.users.router import router as users_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(items_router)
api_router.include_router(system_router)
