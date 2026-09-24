import hashlib
import secrets
import uuid

from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.modules.mcp_keys.exceptions import McpApiKeyNotFoundError
from app.modules.mcp_keys.models import McpApiKey, McpPermission
from app.modules.mcp_keys.schemas import McpApiKeyCreate, McpApiKeyUpdate
from app.modules.projects.dependencies import require_project
from app.modules.users.models import User

KEY_RANDOM_BYTES = 32
KEY_PREFIX_LENGTH = 8
KEY_SUFFIX_LENGTH = 4
KEY_PREFIX = "mcp_"


def create_api_key(
    *, session: Session, body: McpApiKeyCreate, user: User
) -> tuple[McpApiKey, str]:
    require_project(session, user, body.project_id)

    key = KEY_PREFIX + secrets.token_urlsafe(KEY_RANDOM_BYTES)

    api_key = McpApiKey(
        name=body.name,
        project_id=body.project_id,
        permission=body.permission,
        created_by=user.id,
        token_hash=hash_api_key(key),
        key_prefix=key[:KEY_PREFIX_LENGTH],
        key_suffix=key[-KEY_SUFFIX_LENGTH:],
    )

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    return api_key, key


def list_api_keys(
    session: Session,
    project_id: uuid.UUID,
    skip: int,
    limit: int,
    search: str | None,
    permission: McpPermission | None,
    is_active: bool | None,
) -> tuple[list[McpApiKey], int]:
    filters: list[ColumnElement[bool]] = [col(McpApiKey.project_id) == project_id]

    if search:
        filters.append(col(McpApiKey.name).icontains(search.strip(), autoescape=True))

    if permission is not None:
        filters.append(col(McpApiKey.permission) == permission)

    if is_active is not None:
        filters.append(col(McpApiKey.is_active) == is_active)

    count = session.exec(
        select(func.count()).select_from(McpApiKey).where(*filters)
    ).one()

    rows = session.exec(
        select(McpApiKey)
        .where(*filters)
        .order_by(col(McpApiKey.created_at).desc(), col(McpApiKey.id))
        .offset(skip)
        .limit(limit)
    ).all()

    return list(rows), count


def update_api_key(
    *, session: Session, key_id: uuid.UUID, body: McpApiKeyUpdate, user: User
) -> McpApiKey:
    api_key = get_api_key(session=session, key_id=key_id)

    require_project(session, user, api_key.project_id)

    api_key.name = body.name
    api_key.is_active = body.is_active
    api_key.permission = body.permission

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    return api_key


def delete_api_key(*, session: Session, key_id: uuid.UUID, user: User) -> None:
    api_key = get_api_key(session=session, key_id=key_id)

    require_project(session, user, api_key.project_id)
    session.delete(api_key)
    session.commit()


def authenticate_api_key(*, session: Session, token: str) -> McpApiKey | None:
    return session.exec(
        select(McpApiKey).where(
            McpApiKey.token_hash == hash_api_key(token),
            col(McpApiKey.is_active).is_(True),
        )
    ).first()


def get_api_key(*, session: Session, key_id: uuid.UUID) -> McpApiKey:
    api_key = session.get(McpApiKey, key_id)

    if api_key is None:
        raise McpApiKeyNotFoundError

    return api_key


def hash_api_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
