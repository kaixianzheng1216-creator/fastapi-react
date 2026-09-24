import asyncio
from uuid import UUID

from fastapi import Request
from fastapi.exceptions import HTTPException
from fastmcp.server.auth import AccessToken, TokenVerifier
from sqlmodel import Session

from app.api.dependencies import SessionDep
from app.db.session import engine
from app.modules.knowledge.access import KnowledgeAccess
from app.modules.mcp_keys.models import McpPermission
from app.modules.mcp_keys.service import authenticate_api_key


class DatabaseTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        key = await asyncio.to_thread(self._authenticate, token)

        if key is None:
            return None

        key_id, permission = key

        scopes = []

        if permission == McpPermission.READ_WRITE:
            scopes.append(McpPermission.READ_WRITE.value)

        return AccessToken(token=token, client_id=str(key_id), scopes=scopes)

    def _authenticate(self, token: str) -> tuple[UUID, McpPermission] | None:
        with Session(engine) as session:
            key = authenticate_api_key(session=session, token=token)

            if key is None:
                return None

            return key.id, key.permission


def get_project_mcp_access(session: SessionDep, request: Request) -> KnowledgeAccess:
    header = request.headers.get("authorization", "")

    scheme, _, token = header.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="项目 MCP 密钥无效")

    key = authenticate_api_key(session=session, token=token)

    if key is None:
        raise HTTPException(status_code=401, detail="项目 MCP 密钥无效")

    return KnowledgeAccess(key=key)
