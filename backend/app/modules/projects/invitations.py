import hashlib
import secrets
import uuid
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import settings
from app.db.timestamps import utc_now
from app.modules.projects.dependencies import require_project
from app.modules.projects.exceptions import InvitationUnavailableError
from app.modules.projects.models import Project, ProjectInvitation, ProjectMember
from app.modules.projects.schemas import (
    InvitationCreate,
    InvitationCreated,
    InvitationPublic,
)
from app.modules.users.models import User


def create_invitation(
    session: Session, user: User, project_id: uuid.UUID, body: InvitationCreate
) -> InvitationCreated:
    require_project(session, user, project_id, manage_members=True)

    token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=body.expires_in_days)

    session.add(
        ProjectInvitation(
            project_id=project_id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            created_by=user.id,
            expires_at=expires_at,
        )
    )
    session.commit()

    return InvitationCreated(
        url=f"{str(settings.APP_ORIGIN).rstrip('/')}/invite/{token}",
        expires_at=expires_at,
    )


def invitation_project(session: Session, token: str) -> Project:
    project = session.exec(
        select(Project)
        .join(ProjectInvitation)
        .where(
            ProjectInvitation.token_hash == hashlib.sha256(token.encode()).hexdigest(),
            ProjectInvitation.expires_at > utc_now(),
        )
    ).one_or_none()

    if project is None:
        raise InvitationUnavailableError

    return project


def read_invitation(
    session: Session, user: User | None, token: str
) -> InvitationPublic:
    project = invitation_project(session, token)
    member = session.get(ProjectMember, (project.id, user.id)) if user else None

    return InvitationPublic(
        project_id=project.id,
        project_name=project.name,
        current_user_name=(user.full_name or user.username) if user else None,
        is_member=member is not None,
    )


def accept_invitation(session: Session, user: User, token: str) -> Project:
    project = invitation_project(session, token)
    key = (project.id, user.id)

    if session.get(ProjectMember, key) is None:
        session.add(ProjectMember(project_id=project.id, user_id=user.id))

        try:
            session.commit()
        except IntegrityError:
            session.rollback()

            if session.get(ProjectMember, key) is None:
                raise

    return project
