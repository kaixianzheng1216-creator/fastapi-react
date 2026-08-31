from fastapi import APIRouter

from app.modules.agent.router import router as agent_router
from app.modules.auth.router import (
    authenticated_router as authenticated_auth_router,
)
from app.modules.auth.router import public_router as public_auth_router
from app.modules.brand_marketing.router import router as brand_marketing_router
from app.modules.content_operations.router import router as content_operations_router
from app.modules.conversations.router import router as conversations_router
from app.modules.files.router import router as files_router
from app.modules.influencer_marketing.router import (
    router as influencer_marketing_router,
)
from app.modules.knowledge.router import document_router as knowledge_document_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.skills.router import router as skills_router
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
api_router.include_router(brand_marketing_router)
api_router.include_router(knowledge_router)
api_router.include_router(knowledge_document_router)
api_router.include_router(conversations_router)
api_router.include_router(content_operations_router)
api_router.include_router(influencer_marketing_router)
api_router.include_router(files_router)
api_router.include_router(skills_router)
api_router.include_router(agent_router)
