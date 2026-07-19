from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import ApplicationError


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)


async def application_error_handler(
    _request: Request, exception: Exception
) -> JSONResponse:
    assert isinstance(exception, ApplicationError)

    return JSONResponse(
        status_code=exception.status_code,
        content={"detail": exception.detail},
        headers=exception.headers,
    )
