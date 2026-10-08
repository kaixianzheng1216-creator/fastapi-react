import hashlib
import secrets
import time
from typing import cast

from pydantic import ValidationError
from redis import Redis
from redis.exceptions import RedisError

from app.modules.auth.exceptions import AuthUnavailableError, CredentialsValidationError
from app.modules.auth.schemas import LoginSession

SESSION_COOKIE = "data_hub_session"


class SessionStore:
    def __init__(self, redis: Redis) -> None:
        """接收 Redis 客户端，供会话读写使用。"""
        self.redis = redis

    @staticmethod
    def _key(session_id: str) -> str:
        """传入会话 ID，返回对应的 Redis 存储键。"""
        digest = hashlib.sha256(session_id.encode()).hexdigest()

        return f"auth:session:{digest}"

    def create(self, session: LoginSession) -> tuple[str, int]:
        """传入登录信息，保存到 Redis，返回新会话 ID 和有效秒数。"""
        ttl = int(session.expires_at - time.time())

        if ttl <= 0:
            raise CredentialsValidationError

        session_id = secrets.token_urlsafe(32)

        try:
            self.redis.set(self._key(session_id), session.model_dump_json(), ex=ttl)
        except RedisError:
            raise AuthUnavailableError from None

        return session_id, ttl

    def read(self, session_id: str | None) -> LoginSession | None:
        """读取登录信息；会话不存在或已被 Redis 自动过期时返回 None。"""
        if not session_id:
            return None

        try:
            raw = cast(str | None, self.redis.get(self._key(session_id)))

            if raw is None:
                return None

            return LoginSession.model_validate_json(raw)
        except RedisError, ValidationError:
            raise AuthUnavailableError from None

    def delete(self, session_id: str | None) -> None:
        """传入会话 ID，删除对应的 Redis 记录；没有 ID 时不操作。"""
        if not session_id:
            return

        try:
            self.redis.delete(self._key(session_id))
        except RedisError:
            raise AuthUnavailableError from None
