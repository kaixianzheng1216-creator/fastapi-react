import sentry_sdk
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.routing import APIRoute
from scalar_fastapi import get_scalar_api_reference
from starlette.middleware.cors import CORSMiddleware

from app.api.exception_handlers import add_exception_handlers
from app.api.router import api_router
from app.core.config import settings


def custom_generate_unique_id(route: APIRoute) -> str:
    tag = route.tags[0] if route.tags else route.name
    return f"{tag}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
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


# 设置所有启用的 CORS 源
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
