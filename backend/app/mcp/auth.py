from fastapi import status
from fastapi.exceptions import HTTPException
from fastmcp.server.auth import StaticTokenVerifier

from app.api.dependencies import SessionDep
from app.core.config import settings
from app.modules.users import service as users_service
from app.modules.users.models import User


def create_api_key_auth(
    api_key: str,
    client_id: str,
) -> StaticTokenVerifier:
    return StaticTokenVerifier(tokens={api_key: {"client_id": client_id}})


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
