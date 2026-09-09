from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastmcp.utilities.lifespan import combine_lifespans
from scalar_fastapi import get_scalar_api_reference
from starlette.middleware.cors import CORSMiddleware

from app.api.exception_handlers import add_exception_handlers
from app.api.openapi import custom_generate_unique_id
from app.api.router import api_router
from app.core.config import API_V1_PREFIX, PROJECT_NAME, settings
from app.mcp.server import create_mcp_servers
from app.modules.agent.resources import open_agent_resources
from app.modules.agent.run_stream import AgentRunStream


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with open_agent_resources() as resources:
        app.state.agent_resources = resources

        run_stream = AgentRunStream(redis_url=settings.REDIS_URL)

        await run_stream.connect()

        app.state.agent_run_stream = run_stream

        try:
            yield
        finally:
            await run_stream.close()


app = FastAPI(
    title=PROJECT_NAME,
    openapi_url=f"{API_V1_PREFIX}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

add_exception_handlers(app)


@app.get("/scalar", include_in_schema=False)
async def scalar_html() -> HTMLResponse:
    return get_scalar_api_reference(
        openapi_url=f"{API_V1_PREFIX}/openapi.json",
        title=PROJECT_NAME,
    )


if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=API_V1_PREFIX)

internal_mcp, external_mcp = create_mcp_servers()
internal_mcp_app = internal_mcp.http_app(path="/", stateless_http=True)
external_mcp_app = external_mcp.http_app(path="/", stateless_http=True)

app.router.lifespan_context = combine_lifespans(
    lifespan,
    internal_mcp_app.lifespan,
    external_mcp_app.lifespan,
)

app.mount("/mcp/internal", internal_mcp_app)
app.mount("/mcp/external", external_mcp_app)
