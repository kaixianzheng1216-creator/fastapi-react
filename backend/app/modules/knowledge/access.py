import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import Session

from app.modules.auth.dependencies import CurrentUser
from app.modules.knowledge.exceptions import (
    KnowledgeBaseNotFoundError,
    KnowledgeDocumentNotFoundError,
)
from app.modules.knowledge.models import KnowledgeBase, KnowledgeDocument
from app.modules.mcp_keys.models import McpApiKey, McpPermission
from app.modules.projects.dependencies import require_project
from app.modules.users.exceptions import InsufficientPrivilegesError
from app.modules.users.models import User


@dataclass(frozen=True)
class KnowledgeAccess:
    user: User | None = None
    key: McpApiKey | None = None

    @property
    def owner_id(self) -> uuid.UUID:
        if self.key is not None:
            return self.key.created_by

        if self.user is None:
            raise RuntimeError("缺少知识库访问身份")

        return self.user.id

    def project(
        self, session: Session, project_id: uuid.UUID | None, *, write: bool = False
    ) -> uuid.UUID:
        if self.key is not None:
            if write and self.key.permission != McpPermission.READ_WRITE:
                raise InsufficientPrivilegesError

            if project_id is not None and project_id != self.key.project_id:
                raise KnowledgeBaseNotFoundError

            return self.key.project_id

        if project_id is None:
            raise HTTPException(status_code=422, detail="必须指定 project_id")

        if self.user is None:
            raise RuntimeError("缺少知识库访问身份")

        require_project(session, self.user, project_id)

        return project_id

    def base(
        self, session: Session, base_id: uuid.UUID, *, write: bool = False
    ) -> KnowledgeBase:
        base = session.get(KnowledgeBase, base_id)

        if base is None:
            raise KnowledgeBaseNotFoundError

        self.project(session, base.project_id, write=write)

        if (
            self.key is not None
            and self.key.permission == McpPermission.READ_ONLY
            and not base.is_enabled
        ):
            raise KnowledgeBaseNotFoundError

        return base

    def document(
        self, session: Session, document_id: uuid.UUID, *, write: bool = False
    ) -> None:
        document = session.get(KnowledgeDocument, document_id)

        if document is None:
            raise KnowledgeDocumentNotFoundError

        self.base(session, document.knowledge_base_id, write=write)


def get_knowledge_access(user: CurrentUser) -> KnowledgeAccess:
    return KnowledgeAccess(user=user)


KnowledgeAccessDep = Annotated[KnowledgeAccess, Depends(get_knowledge_access)]
