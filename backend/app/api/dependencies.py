from collections.abc import Generator
from typing import Annotated, cast

from fastapi import Depends, Request
from langgraph.store.postgres.aio import AsyncPostgresStore
from sqlmodel import Session

from app.db.session import engine


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]


def get_store(request: Request) -> AsyncPostgresStore:
    return cast(AsyncPostgresStore, request.app.state.store)


StoreDep = Annotated[AsyncPostgresStore, Depends(get_store)]
