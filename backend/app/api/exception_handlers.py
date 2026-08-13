from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import ApplicationError
from app.common.schemas import ErrorResponse


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, handle_application_error)


async def handle_application_error(
    _request: Request,
    exception: Exception,
) -> JSONResponse:
    assert isinstance(exception, ApplicationError)

    return JSONResponse(
        status_code=exception.status_code,
        content=ErrorResponse(detail=exception.detail).model_dump(),
        headers=exception.headers,
    )
