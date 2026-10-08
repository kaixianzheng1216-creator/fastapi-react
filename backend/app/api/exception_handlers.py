from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.common.exceptions import ApplicationError
from app.common.schemas import ErrorResponse
from app.core.config import settings
from app.modules.auth.exceptions import InactiveSessionError, InvalidSessionError
from app.modules.auth.session import SESSION_COOKIE
from app.modules.mcp_keys.exceptions import McpApiKeyNotFoundError

MCP_API_KEY_NOT_FOUND_MESSAGE = "MCP 密钥不存在"


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)
    app.add_exception_handler(McpApiKeyNotFoundError, mcp_api_key_not_found_handler)


async def application_error_handler(
    _request: Request, exception: Exception
) -> JSONResponse:
    assert isinstance(exception, ApplicationError)

    response = JSONResponse(
        status_code=exception.status_code,
        content=ErrorResponse(detail=exception.detail).model_dump(),
        headers=exception.headers,
    )

    if isinstance(exception, (InvalidSessionError, InactiveSessionError)):
        response.delete_cookie(
            SESSION_COOKIE,
            path="/",
            secure=settings.ENVIRONMENT == "production",
            httponly=True,
            samesite="lax",
        )

        response.headers["Cache-Control"] = "no-store"

    return response


async def mcp_api_key_not_found_handler(
    _request: Request, _exception: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=ErrorResponse(detail=MCP_API_KEY_NOT_FOUND_MESSAGE).model_dump(),
    )
