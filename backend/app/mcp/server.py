from typing import Any

import httpx
from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.server.auth import require_scopes
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.providers.openapi import MCPType
from fastmcp.server.providers.openapi.components import OpenAPITool
from fastmcp.utilities.openapi import HTTPRoute

from app.api.exception_handlers import add_exception_handlers
from app.api.openapi import custom_generate_unique_id
from app.core.config import API_V1_PREFIX
from app.mcp.auth import DatabaseTokenVerifier, get_project_mcp_access
from app.mcp.catalog import PROJECT_ROUTERS
from app.mcp.operations import PROJECT_OPERATIONS, READ_ONLY_KNOWLEDGE_OPERATIONS
from app.modules.auth.dependencies import get_current_active_superuser
from app.modules.knowledge.access import get_knowledge_access
from app.modules.mcp_keys.models import McpPermission


def create_mcp_server() -> FastMCP:
    def map_route(route: HTTPRoute, _: MCPType) -> MCPType:
        if route.operation_id in PROJECT_OPERATIONS:
            return MCPType.TOOL

        return MCPType.EXCLUDE

    return FastMCP.from_fastapi(
        app=_create_project_api(),
        name="Data Hub Project",
        auth=DatabaseTokenVerifier(),
        route_map_fn=map_route,
        mcp_names=PROJECT_OPERATIONS,
        mcp_component_fn=_configure_project_tool,
        httpx_client_kwargs={"event_hooks": {"request": [_forward_project_token]}},
    )


def _create_project_api() -> FastAPI:
    app = FastAPI(generate_unique_id_function=custom_generate_unique_id)

    add_exception_handlers(app)

    app.dependency_overrides[get_knowledge_access] = get_project_mcp_access

    app.dependency_overrides[get_current_active_superuser] = get_project_mcp_access

    for router in PROJECT_ROUTERS:
        app.include_router(router, prefix=API_V1_PREFIX)

    return app


def _configure_project_tool(route: HTTPRoute, component: Any) -> None:
    if (
        isinstance(component, OpenAPITool)
        and route.operation_id not in READ_ONLY_KNOWLEDGE_OPERATIONS
    ):
        component.auth = require_scopes(McpPermission.READ_WRITE.value)


async def _forward_project_token(request: httpx.Request) -> None:
    token = get_access_token()

    if token is None:
        raise PermissionError("需要项目 MCP 密钥认证")

    request.headers["Authorization"] = f"Bearer {token.token}"
