from fastapi import FastAPI
from fastmcp import FastMCP
from fastmcp.server.providers.openapi import MCPType
from fastmcp.utilities.openapi import HTTPRoute

from app.api.openapi import custom_generate_unique_id
from app.core.config import API_V1_PREFIX, settings
from app.mcp.auth import create_api_key_auth, get_internal_mcp_user
from app.mcp.external import router as external_knowledge_router
from app.mcp.operations import EXTERNAL_OPERATIONS, INTERNAL_OPERATIONS
from app.modules.auth.dependencies import (
    get_current_active_superuser,
    get_current_user,
)
from app.modules.brand_marketing.router import router as brand_marketing_router
from app.modules.content_operations.router import router as content_operations_router
from app.modules.influencer_marketing.router import (
    router as influencer_marketing_router,
)
from app.modules.knowledge.router import document_router as knowledge_document_router
from app.modules.knowledge.router import router as knowledge_router


def create_mcp_servers() -> tuple[FastMCP, FastMCP]:
    internal = _create_server(
        _create_internal_api(),
        name="Data Hub Internal",
        operations=INTERNAL_OPERATIONS,
        api_key=settings.MCP_INTERNAL_API_KEY,
        client_id="data-hub-internal",
    )

    external = _create_server(
        _create_external_api(),
        name="Data Hub External",
        operations=EXTERNAL_OPERATIONS,
        api_key=settings.MCP_EXTERNAL_API_KEY,
        client_id="data-hub-external",
    )

    return internal, external


def _create_internal_api() -> FastAPI:
    app = FastAPI(generate_unique_id_function=custom_generate_unique_id)
    app.dependency_overrides[get_current_user] = get_internal_mcp_user
    app.dependency_overrides[get_current_active_superuser] = get_internal_mcp_user

    app.include_router(knowledge_router, prefix=API_V1_PREFIX)
    app.include_router(knowledge_document_router, prefix=API_V1_PREFIX)
    app.include_router(brand_marketing_router, prefix=API_V1_PREFIX)
    app.include_router(content_operations_router, prefix=API_V1_PREFIX)
    app.include_router(influencer_marketing_router, prefix=API_V1_PREFIX)

    return app


def _create_external_api() -> FastAPI:
    app = FastAPI(generate_unique_id_function=custom_generate_unique_id)
    app.dependency_overrides[get_current_active_superuser] = _external_mcp_authenticated

    app.include_router(external_knowledge_router, prefix=API_V1_PREFIX)
    app.include_router(brand_marketing_router, prefix=API_V1_PREFIX)
    app.include_router(content_operations_router, prefix=API_V1_PREFIX)
    app.include_router(influencer_marketing_router, prefix=API_V1_PREFIX)

    return app


def _external_mcp_authenticated() -> None:
    return None


def _create_server(
    app: FastAPI,
    *,
    name: str,
    operations: dict[str, str],
    api_key: str,
    client_id: str,
) -> FastMCP:
    def map_route(route: HTTPRoute, _: MCPType) -> MCPType:
        if route.operation_id in operations:
            return MCPType.TOOL

        return MCPType.EXCLUDE

    return FastMCP.from_fastapi(
        app=app,
        name=name,
        auth=create_api_key_auth(api_key, client_id),
        route_map_fn=map_route,
        mcp_names=operations,
    )
