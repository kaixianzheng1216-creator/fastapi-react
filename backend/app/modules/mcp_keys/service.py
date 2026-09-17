import hashlib
import secrets
import uuid

from sqlmodel import Session, col, select

from app.modules.mcp_keys.exceptions import McpApiKeyNotFoundError
from app.modules.mcp_keys.models import McpApiKey, McpScope
from app.modules.mcp_keys.schemas import McpApiKeyCreate, McpApiKeyUpdate

KEY_RANDOM_BYTES = 32
KEY_PREFIX_LENGTH = 8
KEY_SUFFIX_LENGTH = 4
KEY_PREFIX = "mcp_"


def create_api_key(*, session: Session, body: McpApiKeyCreate) -> tuple[McpApiKey, str]:
    key = KEY_PREFIX + secrets.token_urlsafe(KEY_RANDOM_BYTES)

    api_key = McpApiKey(
        name=body.name,
        scope=body.scope,
        token_hash=hash_api_key(key),
        key_prefix=key[:KEY_PREFIX_LENGTH],
        key_suffix=key[-KEY_SUFFIX_LENGTH:],
    )

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    return api_key, key


def list_api_keys(*, session: Session, scope: McpScope) -> list[McpApiKey]:
    return list(
        session.exec(
            select(McpApiKey)
            .where(McpApiKey.scope == scope)
            .order_by(col(McpApiKey.created_at).desc(), col(McpApiKey.id))
        ).all()
    )


def update_api_key(
    *, session: Session, key_id: uuid.UUID, body: McpApiKeyUpdate
) -> McpApiKey:
    api_key = get_api_key(session=session, key_id=key_id)

    api_key.name = body.name
    api_key.is_active = body.is_active

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    return api_key


def delete_api_key(*, session: Session, key_id: uuid.UUID) -> None:
    api_key = get_api_key(session=session, key_id=key_id)

    session.delete(api_key)
    session.commit()


def get_api_key(*, session: Session, key_id: uuid.UUID) -> McpApiKey:
    api_key = session.get(McpApiKey, key_id)

    if api_key is None:
        raise McpApiKeyNotFoundError

    return api_key


def authenticate_api_key(
    *, session: Session, token: str, scope: McpScope
) -> uuid.UUID | None:
    return session.exec(
        select(McpApiKey.id).where(
            McpApiKey.token_hash == hash_api_key(token),
            McpApiKey.scope == scope,
            col(McpApiKey.is_active).is_(True),
        )
    ).first()


def hash_api_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
