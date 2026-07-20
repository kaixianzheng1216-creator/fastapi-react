from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.routing import APIRoute
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection
from scalar_fastapi import get_scalar_api_reference
from starlette.middleware.cors import CORSMiddleware

from app.api.exception_handlers import add_exception_handlers
from app.api.router import api_router
from app.core.config import settings
from app.modules.agent import service as agent_service

CHECKPOINT_SCHEMA = "agent"


def custom_generate_unique_id(route: APIRoute) -> str:
    tag = route.tags[0] if route.tags else route.name
    return f"{tag}-{route.name}"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    database_uri = str(settings.CHECKPOINT_DATABASE_URI)

    async with await AsyncConnection.connect(
        database_uri,
        autocommit=True,
    ) as connection:
        await connection.execute(f"CREATE SCHEMA IF NOT EXISTS {CHECKPOINT_SCHEMA}")

    async with AsyncPostgresSaver.from_conn_string(
        f"{database_uri}?options=-csearch_path%3D{CHECKPOINT_SCHEMA}"
    ) as checkpointer:
        await checkpointer.setup()

        app.state.agent = await agent_service.create_agent(checkpointer)

        yield


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

add_exception_handlers(app)


@app.get("/scalar", include_in_schema=False)
async def scalar_html() -> HTMLResponse:
    return get_scalar_api_reference(
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        title=settings.PROJECT_NAME,
    )


if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
