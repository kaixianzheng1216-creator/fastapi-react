from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Any, cast
from uuid import UUID

from assistant_stream.assistant_stream_chunk import (  # type: ignore[import-untyped]
    ErrorChunk,
)
from assistant_stream.serialization import (  # type: ignore[import-untyped]
    AssistantTransportEncoder,
)
from redis.asyncio import Redis

KEY_PREFIX = "fastapi-react:agent-run"

STREAM_DATA_FIELD = b"data"
# 1024 * 1024 字节 = 1 MB
MAX_STREAM_CHUNK_BYTES = 1024 * 1024
# 每次最多读取 100 条
STREAM_READ_COUNT = 100
# 1000 毫秒 = 1 秒
STREAM_BLOCK_MILLISECONDS = 1000
# 60 秒 * 60 分钟 * 24 小时 = 1 天
STREAM_TTL_SECONDS = 60 * 60 * 24

# 30 秒
HEARTBEAT_TTL_SECONDS = 30
# 10 秒
HEARTBEAT_INTERVAL_SECONDS = 10


class AgentRunStream:
    def __init__(
        self,
        *,
        redis_url: str,
    ) -> None:
        self._redis = Redis.from_url(redis_url, decode_responses=False)

    async def connect(self) -> None:
        await cast(Awaitable[Any], self._redis.ping())

    async def append(self, run_id: UUID, data: bytes) -> None:
        if len(data) > MAX_STREAM_CHUNK_BYTES:
            raise ValueError("Agent 流式数据块超过大小限制")

        pipeline = self._redis.pipeline(transaction=False)

        pipeline.xadd(
            self._stream_key(run_id),
            {STREAM_DATA_FIELD: data},
        )

        pipeline.expire(self._stream_key(run_id), STREAM_TTL_SECONDS)

        await pipeline.execute()

    async def append_error(self, run_id: UUID, detail: str) -> None:
        async def chunks() -> AsyncGenerator[ErrorChunk]:
            yield ErrorChunk(error=detail)

        encoder = AssistantTransportEncoder()

        async for chunk in encoder.encode_stream(chunks()):
            await self.append(run_id, chunk.encode())

    async def stream(
        self,
        run_id: UUID,
        should_stop: Callable[[], Awaitable[bool]],
    ) -> AsyncGenerator[bytes]:
        cursor = "0-0"
        stream_key = self._stream_key(run_id)

        while True:
            entries = await self._redis.xread(
                {stream_key: cursor},
                count=STREAM_READ_COUNT,
                block=STREAM_BLOCK_MILLISECONDS,
            )

            if not entries:
                if await should_stop():
                    return

                continue

            _stream_name, messages = entries[0]

            for message_id, fields in messages:
                cursor = self._decode(message_id)

                data = fields.get(STREAM_DATA_FIELD)

                if data is not None:
                    yield data if isinstance(data, bytes) else data.encode()

    async def has_stream(self, run_id: UUID) -> bool:
        return bool(await self._redis.exists(self._stream_key(run_id)))

    async def request_cancel(self, run_id: UUID) -> None:
        await self._redis.set(
            self._cancel_key(run_id),
            b"1",
            ex=STREAM_TTL_SECONDS,
        )

    async def is_cancel_requested(self, run_id: UUID) -> bool:
        return bool(await self._redis.exists(self._cancel_key(run_id)))

    async def refresh_heartbeat(self, run_id: UUID) -> None:
        await self._redis.set(
            self._heartbeat_key(run_id),
            b"1",
            ex=HEARTBEAT_TTL_SECONDS,
        )

    async def has_heartbeat(self, run_id: UUID) -> bool:
        return bool(await self._redis.exists(self._heartbeat_key(run_id)))

    async def finalize(self, run_id: UUID) -> None:
        pipeline = self._redis.pipeline(transaction=False)

        pipeline.expire(self._stream_key(run_id), STREAM_TTL_SECONDS)
        pipeline.delete(self._cancel_key(run_id))
        pipeline.delete(self._heartbeat_key(run_id))

        await pipeline.execute()

    async def close(self) -> None:
        await cast(Awaitable[Any], self._redis.aclose())

    @staticmethod
    def _decode(value: bytes | str) -> str:
        return value.decode() if isinstance(value, bytes) else value

    @staticmethod
    def _stream_key(run_id: UUID) -> str:
        return f"{KEY_PREFIX}:{run_id}:stream"

    @staticmethod
    def _heartbeat_key(run_id: UUID) -> str:
        return f"{KEY_PREFIX}:{run_id}:heartbeat"

    @staticmethod
    def _cancel_key(run_id: UUID) -> str:
        return f"{KEY_PREFIX}:{run_id}:cancel"
