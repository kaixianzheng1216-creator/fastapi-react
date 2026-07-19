from typing import ClassVar


class ApplicationError(Exception):
    status_code: ClassVar[int]
    detail: ClassVar[str]
    headers: ClassVar[dict[str, str] | None] = None
