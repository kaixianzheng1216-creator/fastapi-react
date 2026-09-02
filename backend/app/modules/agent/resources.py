from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg import AsyncConnection

from app.core.config import settings
from app.modules.agent.agent import create_agent

CHECKPOINT_SCHEMA = "agent"


@dataclass(slots=True)
class AgentResources:
    checkpointer: AsyncPostgresSaver
    store: AsyncPostgresStore
    agent: Any


@asynccontextmanager
async def open_agent_checkpointer() -> AsyncIterator[AsyncPostgresSaver]:
    database_uri = str(settings.CHECKPOINT_DATABASE_URI)

    async with await AsyncConnection.connect(
        database_uri,
        autocommit=True,
    ) as connection:
        await connection.execute(f"CREATE SCHEMA IF NOT EXISTS {CHECKPOINT_SCHEMA}")

    store_uri = f"{database_uri}?options=-csearch_path%3D{CHECKPOINT_SCHEMA}"

    async with AsyncPostgresSaver.from_conn_string(store_uri) as checkpointer:
        await checkpointer.setup()

        yield checkpointer


@asynccontextmanager
async def open_agent_resources() -> AsyncIterator[AgentResources]:
    database_uri = str(settings.CHECKPOINT_DATABASE_URI)
    store_uri = f"{database_uri}?options=-csearch_path%3D{CHECKPOINT_SCHEMA}"

    async with (
        open_agent_checkpointer() as checkpointer,
        AsyncPostgresStore.from_conn_string(store_uri) as store,
    ):
        await store.setup()

        yield AgentResources(
            checkpointer=checkpointer,
            store=store,
            agent=await create_agent(checkpointer, store),
        )
