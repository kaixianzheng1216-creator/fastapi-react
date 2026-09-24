import uuid

from psycopg.errors import ForeignKeyViolation, UniqueViolation
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql.elements import ColumnElement
from sqlmodel import Session, col, func, select

from app.modules.knowledge.models import KnowledgeBase
from app.modules.projects.dependencies import require_project
from app.modules.projects.exceptions import (
    ProjectConflictError,
    ProjectMemberNotFoundError,
    ProjectNotEmptyError,
)
from app.modules.projects.models import Project, ProjectMember, ProjectRole
from app.modules.projects.schemas import (
    CandidatePublic,
    MemberPublic,
    ProjectCreate,
    ProjectPublic,
    ProjectUpdate,
)
from app.modules.users.exceptions import InsufficientPrivilegesError, UserNotFoundError
from app.modules.users.models import User


def create_project(session: Session, body: ProjectCreate) -> Project:
    validate_users(session, body.admin_ids)

    project = Project(name=body.name, description=body.description)
    session.add(project)

    for user_id in body.admin_ids:
        session.add(
            ProjectMember(
                project_id=project.id, user_id=user_id, role=ProjectRole.ADMIN
            )
        )

    commit(session)

    session.refresh(project)

    return project


def list_projects(
    session: Session, user: User, skip: int, limit: int, search: str | None
) -> tuple[list[ProjectPublic], int]:
    term = search.strip() if search else ""

    pattern = f"%{term.replace('/', '//').replace('%', '/%').replace('_', '/_')}%"

    params = {
        "user_id": user.id,
        "is_superuser": user.is_superuser,
        "has_search": bool(search),
        "pattern": pattern,
        "skip": skip,
        "limit": limit,
    }

    connection = session.connection()

    count = connection.execute(
        text(
            """
            SELECT count(*)
            FROM project p
            WHERE (
                :is_superuser OR EXISTS (
                    SELECT 1 FROM project_member pm_access
                    WHERE pm_access.project_id = p.id AND pm_access.user_id = :user_id
                )
            )
            AND (
                NOT :has_search
                OR p.name ILIKE :pattern ESCAPE '/'
                OR p.description ILIKE :pattern ESCAPE '/'
            )
            """
        ),
        params,
    ).scalar_one()

    rows = connection.execute(
        text(
            """
            SELECT
                p.id, p.name, p.description, p.created_at, p.updated_at,
                CASE WHEN :is_superuser THEN 'admin' ELSE pm.role END AS role,
                (
                    SELECT count(*)
                    FROM project_member pm_count
                    JOIN "user" u ON u.id = pm_count.user_id
                    WHERE pm_count.project_id = p.id AND u.deleted_at IS NULL
                ) AS member_count,
                (
                    SELECT count(*) FROM knowledge_base kb WHERE kb.project_id = p.id
                ) AS knowledge_base_count
            FROM project p
            LEFT JOIN project_member pm
                ON pm.project_id = p.id AND pm.user_id = :user_id
            WHERE (
                :is_superuser OR EXISTS (
                    SELECT 1 FROM project_member pm_access
                    WHERE pm_access.project_id = p.id AND pm_access.user_id = :user_id
                )
            )
            AND (
                NOT :has_search
                OR p.name ILIKE :pattern ESCAPE '/'
                OR p.description ILIKE :pattern ESCAPE '/'
            )
            ORDER BY p.created_at, p.id
            LIMIT :limit OFFSET :skip
            """
        ),
        params,
    ).mappings()

    return [ProjectPublic.model_validate(dict(row)) for row in rows], count


def project_public(session: Session, project: Project, user: User) -> ProjectPublic:
    member = session.get(ProjectMember, (project.id, user.id))

    return ProjectPublic.model_validate(project).model_copy(
        update={
            "role": ProjectRole.ADMIN
            if user.is_superuser
            else member.role
            if member
            else None,
            "member_count": session.exec(
                select(func.count())
                .select_from(ProjectMember)
                .join(User, col(User.id) == col(ProjectMember.user_id))
                .where(
                    col(ProjectMember.project_id) == project.id,
                    col(User.deleted_at).is_(None),
                )
            ).one(),
            "knowledge_base_count": session.exec(
                select(func.count())
                .select_from(KnowledgeBase)
                .where(col(KnowledgeBase.project_id) == project.id)
            ).one(),
        }
    )


def update_project(session: Session, project: Project, body: ProjectUpdate) -> Project:
    project.sqlmodel_update(body.model_dump(exclude_unset=True))

    commit(session)

    session.refresh(project)

    return project


def delete_project(session: Session, project: Project) -> None:
    if session.exec(
        select(col(KnowledgeBase.id))
        .where(col(KnowledgeBase.project_id) == project.id)
        .limit(1)
    ).first():
        raise ProjectNotEmptyError

    session.delete(project)

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, ForeignKeyViolation):
            raise ProjectNotEmptyError from error
        raise


def list_members(
    session: Session,
    user: User,
    project_id: uuid.UUID,
    skip: int,
    limit: int,
    search: str | None,
    role: ProjectRole | None,
) -> tuple[list[MemberPublic], int]:
    require_project(session, user, project_id, manage_members=True)

    filters: list[ColumnElement[bool]] = [
        col(ProjectMember.project_id) == project_id,
        col(User.deleted_at).is_(None),
    ]

    if search:
        filters.append(
            or_(
                col(User.username).icontains(search.strip(), autoescape=True),
                col(User.full_name).icontains(search.strip(), autoescape=True),
            )
        )

    if role:
        filters.append(col(ProjectMember.role) == role)

    count = session.exec(
        select(func.count())
        .select_from(ProjectMember)
        .join(User, col(User.id) == col(ProjectMember.user_id))
        .where(*filters)
    ).one()

    rows = session.exec(
        select(ProjectMember, User)
        .join(User, col(User.id) == col(ProjectMember.user_id))
        .where(*filters)
        .order_by(User.username, col(User.id))
        .offset(skip)
        .limit(limit)
    ).all()

    return [
        MemberPublic(
            user_id=member_user.id,
            username=member_user.username,
            full_name=member_user.full_name,
            role=member.role,
            created_at=member.created_at,
        )
        for member, member_user in rows
    ], count


def list_member_candidates(
    session: Session,
    user: User,
    project_id: uuid.UUID,
    skip: int,
    limit: int,
    search: str | None,
) -> tuple[list[CandidatePublic], int]:
    require_project(session, user, project_id, manage_members=True)

    filters: list[ColumnElement[bool]] = [
        col(User.deleted_at).is_(None),
        col(User.is_active).is_(True),
    ]

    if search:
        filters.append(
            or_(
                col(User.username).icontains(search.strip(), autoescape=True),
                col(User.full_name).icontains(search.strip(), autoescape=True),
            )
        )

    count = session.exec(select(func.count()).select_from(User).where(*filters)).one()

    rows = session.exec(
        select(User, col(ProjectMember.user_id))
        .outerjoin(
            ProjectMember,
            (col(ProjectMember.user_id) == col(User.id))
            & (col(ProjectMember.project_id) == project_id),
        )
        .where(*filters)
        .order_by(User.username, col(User.id))
        .offset(skip)
        .limit(limit)
    ).all()

    return [
        CandidatePublic(
            user_id=candidate.id,
            username=candidate.username,
            full_name=candidate.full_name,
            is_member=member_id is not None or candidate.is_superuser,
        )
        for candidate, member_id in rows
    ], count


def add_members(
    session: Session, user: User, project_id: uuid.UUID, ids: set[uuid.UUID]
) -> None:
    require_project(session, user, project_id, manage_members=True)

    validate_users(session, ids)

    existing = set(
        session.exec(
            select(col(ProjectMember.user_id)).where(
                col(ProjectMember.project_id) == project_id,
                col(ProjectMember.user_id).in_(ids),
            )
        ).all()
    )

    session.add_all(
        ProjectMember(project_id=project_id, user_id=user_id)
        for user_id in ids - existing
    )

    commit(session)


def update_member(
    session: Session,
    user: User,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    role: ProjectRole,
) -> None:
    if not user.is_superuser:
        raise InsufficientPrivilegesError

    require_project(session, user, project_id)

    member = session.get(ProjectMember, (project_id, user_id))

    if member is None:
        raise ProjectMemberNotFoundError

    member.role = role

    commit(session)


def remove_member(
    session: Session, user: User, project_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    require_project(session, user, project_id, manage_members=True)

    member = session.exec(
        select(ProjectMember)
        .where(
            col(ProjectMember.project_id) == project_id,
            col(ProjectMember.user_id) == user_id,
        )
        .with_for_update()
    ).first()

    if member is None:
        raise ProjectMemberNotFoundError
    if not user.is_superuser and member.role == ProjectRole.ADMIN:
        raise InsufficientPrivilegesError

    session.delete(member)

    session.commit()


def validate_users(session: Session, ids: set[uuid.UUID]) -> None:
    if not ids:
        return

    found = session.exec(
        select(col(User.id)).where(
            col(User.id).in_(ids),
            col(User.deleted_at).is_(None),
            col(User.is_active).is_(True),
        )
    ).all()

    if set(found) != ids:
        raise UserNotFoundError


def commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()

        if isinstance(error.orig, UniqueViolation):
            raise ProjectConflictError from error
        raise
