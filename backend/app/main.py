import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.routing import APIRoute
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg import AsyncConnection
from scalar_fastapi import get_scalar_api_reference
from starlette.middleware.cors import CORSMiddleware

from app.api.exception_handlers import add_exception_handlers
from app.api.router import api_router
from app.core.config import API_V1_PREFIX, PROJECT_NAME, settings
from app.modules.agent.agent import create_agent, create_chat_model
from app.modules.files.cleanup import run_file_cleanup

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

    store_uri = f"{database_uri}?options=-csearch_path%3D{CHECKPOINT_SCHEMA}"

    async with (
        AsyncPostgresSaver.from_conn_string(store_uri) as checkpointer,
        AsyncPostgresStore.from_conn_string(store_uri) as store,
    ):
        await checkpointer.setup()
        await store.setup()

        app.state.checkpointer = checkpointer
        app.state.store = store
        app.state.title_model = create_chat_model()
        app.state.agent = await create_agent(checkpointer, store)

        file_cleanup_task = asyncio.create_task(run_file_cleanup())

        try:
            yield
        finally:
            file_cleanup_task.cancel()

            try:
                await file_cleanup_task
            except asyncio.CancelledError:
                pass


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
