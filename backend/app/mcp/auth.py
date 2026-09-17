import asyncio
from uuid import UUID

from fastapi import status
from fastapi.exceptions import HTTPException
from fastmcp.server.auth import AccessToken, TokenVerifier
from sqlmodel import Session

from app.api.dependencies import SessionDep
from app.core.config import settings
from app.db.session import engine
from app.modules.mcp_keys.models import McpScope
from app.modules.mcp_keys.service import authenticate_api_key
from app.modules.users import service as users_service
from app.modules.users.models import User


class DatabaseTokenVerifier(TokenVerifier):
    def __init__(self, scope: McpScope) -> None:
        super().__init__()

        self.scope = scope

    async def verify_token(self, token: str) -> AccessToken | None:
        key_id = await asyncio.to_thread(self._authenticate, token)

        if key_id is None:
            return None

        return AccessToken(token=token, client_id=str(key_id), scopes=[])

    def _authenticate(self, token: str) -> UUID | None:
        with Session(engine) as session:
            return authenticate_api_key(session=session, token=token, scope=self.scope)


def get_internal_mcp_user(session: SessionDep) -> User:
    user = users_service.get_user_by_username(
        session=session,
        username=settings.FIRST_SUPERUSER_USERNAME,
    )

    if (
        user is None
        or user.deleted_at is not None
        or not user.is_active
        or not user.is_superuser
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal MCP user is not available",
        )

    return user
