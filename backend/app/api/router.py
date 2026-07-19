from fastapi import APIRouter

from app.modules.auth.router import (
    authenticated_router as authenticated_auth_router,
)
from app.modules.auth.router import public_router as public_auth_router
from app.modules.items.router import router as items_router
from app.modules.system.router import router as system_router
from app.modules.users.router import admin_router as admin_users_router
from app.modules.users.router import (
    authenticated_router as authenticated_users_router,
)
from app.modules.users.router import public_router as public_users_router

api_router = APIRouter()

api_router.include_router(public_auth_router)
api_router.include_router(public_users_router)
api_router.include_router(system_router)
api_router.include_router(authenticated_auth_router)
api_router.include_router(authenticated_users_router)
api_router.include_router(admin_users_router)
api_router.include_router(items_router)
