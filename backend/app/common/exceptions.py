from dataclasses import dataclass


class ApplicationError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class ErrorResponse:
    status_code: int
    detail: str
    headers: dict[str, str] | None = None
