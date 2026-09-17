from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.common.exceptions import ApplicationError
from app.common.schemas import ErrorResponse
from app.modules.mcp_keys.exceptions import McpApiKeyNotFoundError

MCP_API_KEY_NOT_FOUND_MESSAGE = "MCP 密钥不存在"


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)
    app.add_exception_handler(McpApiKeyNotFoundError, mcp_api_key_not_found_handler)


async def application_error_handler(
    _request: Request, exception: Exception
) -> JSONResponse:
    assert isinstance(exception, ApplicationError)

    return JSONResponse(
        status_code=exception.status_code,
        content=ErrorResponse(detail=exception.detail).model_dump(),
        headers=exception.headers,
    )


async def mcp_api_key_not_found_handler(
    _request: Request, _exception: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=ErrorResponse(detail=MCP_API_KEY_NOT_FOUND_MESSAGE).model_dump(),
    )
