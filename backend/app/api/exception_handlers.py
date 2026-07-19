from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import ApplicationError
from app.modules.auth.exceptions import ERROR_RESPONSES as AUTH_ERROR_RESPONSES
from app.modules.items.exceptions import ERROR_RESPONSES as ITEM_ERROR_RESPONSES
from app.modules.users.exceptions import ERROR_RESPONSES as USER_ERROR_RESPONSES

ERROR_RESPONSES = AUTH_ERROR_RESPONSES | USER_ERROR_RESPONSES | ITEM_ERROR_RESPONSES


async def application_error_handler(
    _request: Request, exception: Exception
) -> JSONResponse:
    assert isinstance(exception, ApplicationError)

    response = ERROR_RESPONSES[type(exception)]

    return JSONResponse(
        status_code=response.status_code,
        content={"detail": response.detail},
        headers=response.headers,
    )


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)
