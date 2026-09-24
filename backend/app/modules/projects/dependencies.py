import uuid

from sqlmodel import Session

from app.modules.projects.exceptions import ProjectNotFoundError
from app.modules.projects.models import Project, ProjectMember, ProjectRole
from app.modules.users.exceptions import InsufficientPrivilegesError
from app.modules.users.models import User


def require_project(
    session: Session, user: User, project_id: uuid.UUID, *, manage_members: bool = False
) -> Project:
    project = session.get(Project, project_id)

    if project is None:
        raise ProjectNotFoundError

    if user.is_superuser:
        return project

    member = session.get(ProjectMember, (project_id, user.id))

    if member is None:
        raise ProjectNotFoundError

    if manage_members and member.role != ProjectRole.ADMIN:
        raise InsufficientPrivilegesError

    return project
