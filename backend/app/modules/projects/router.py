import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.dependencies import SessionDep
from app.api.responses import error_responses
from app.modules.auth.dependencies import (
    CurrentSuperuser,
    CurrentUser,
    OptionalCurrentUser,
)
from app.modules.auth.exceptions import CredentialsValidationError, InactiveUserError
from app.modules.projects import invitations, service
from app.modules.projects.dependencies import require_project
from app.modules.projects.exceptions import (
    InvitationUnavailableError,
    LastProjectAdminError,
    ProjectConflictError,
    ProjectNotFoundError,
)
from app.modules.projects.models import ProjectRole
from app.modules.projects.schemas import (
    CandidatesPublic,
    InvitationCreate,
    InvitationCreated,
    InvitationProject,
    InvitationPublic,
    MembersAdd,
    MembersPublic,
    MemberUpdate,
    ProjectCreate,
    ProjectPublic,
    ProjectsPublic,
    ProjectUpdate,
)
from app.modules.users.exceptions import InsufficientPrivilegesError

router = APIRouter(
    prefix="/admin/projects",
    tags=["projects"],
    responses=error_responses(
        CredentialsValidationError,
        InactiveUserError,
        InsufficientPrivilegesError,
        ProjectNotFoundError,
        ProjectConflictError,
        LastProjectAdminError,
    ),
)

Skip = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]
Search = Annotated[str | None, Query(max_length=255)]

invitation_router = APIRouter(
    prefix="/invitations",
    tags=["invitations"],
    responses=error_responses(
        InvitationUnavailableError, CredentialsValidationError, InactiveUserError
    ),
)


@router.post(
    "/{project_id}/invitations", response_model=InvitationCreated, status_code=201
)
def create_invitation(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: InvitationCreate,
) -> InvitationCreated:
    """创建可供多人使用的独立邀请链接。"""
    return invitations.create_invitation(session, current_user, project_id, body)


@invitation_router.get("/{token}", response_model=InvitationPublic)
def read_invitation(
    token: str,
    response: Response,
    session: SessionDep,
    current_user: OptionalCurrentUser,
) -> InvitationPublic:
    """查看邀请的项目、当前登录用户，以及该用户是否已加入项目。"""
    response.headers["Cache-Control"] = "no-store"

    return invitations.read_invitation(session, current_user, token)


@invitation_router.post("/{token}/accept", response_model=InvitationProject)
def accept_invitation(
    token: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> InvitationProject:
    """通过邀请加入项目，默认为普通成员；已加入的用户不修改角色。"""
    project = invitations.accept_invitation(session, current_user, token)

    return InvitationProject(project_id=project.id, project_name=project.name)


@router.post("", response_model=ProjectPublic, status_code=201)
def create_project(
    session: SessionDep, current_user: CurrentSuperuser, body: ProjectCreate
) -> ProjectPublic:
    """创建项目并指定初始项目管理员。"""
    return service.project_public(
        session, service.create_project(session, body), current_user
    )


@router.get("", response_model=ProjectsPublic)
def read_projects(
    session: SessionDep,
    current_user: CurrentUser,
    skip: Skip = 0,
    limit: Limit = 20,
    search: Search = None,
) -> ProjectsPublic:
    """查询当前用户可访问的项目列表。"""
    data, count = service.list_projects(session, current_user, skip, limit, search)

    return ProjectsPublic(data=data, count=count)


@router.get("/{project_id}", response_model=ProjectPublic)
def read_project(
    project_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> ProjectPublic:
    """获取项目详情。"""
    return service.project_public(
        session, require_project(session, current_user, project_id), current_user
    )


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentSuperuser,
    body: ProjectUpdate,
) -> ProjectPublic:
    """更新项目名称和描述。"""
    project = service.update_project(
        session, require_project(session, current_user, project_id), body
    )

    return service.project_public(session, project, current_user)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: uuid.UUID, session: SessionDep, current_user: CurrentSuperuser
) -> None:
    """删除没有知识库的项目。"""
    service.delete_project(session, require_project(session, current_user, project_id))


@router.get("/{project_id}/members", response_model=MembersPublic)
def read_members(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: Skip = 0,
    limit: Limit = 20,
    search: Search = None,
    role: ProjectRole | None = None,
) -> MembersPublic:
    """查询项目成员列表。"""
    data, count = service.list_members(
        session, current_user, project_id, skip, limit, search, role
    )

    return MembersPublic(data=data, count=count)


@router.get("/{project_id}/member-candidates", response_model=CandidatesPublic)
def read_member_candidates(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    skip: Skip = 0,
    limit: Limit = 20,
    search: Search = None,
) -> CandidatesPublic:
    """查询可添加到项目的用户及其成员状态。"""
    data, count = service.list_member_candidates(
        session, current_user, project_id, skip, limit, search
    )

    return CandidatesPublic(data=data, count=count)


@router.post("/{project_id}/members", status_code=204)
def add_members(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    body: MembersAdd,
) -> None:
    """批量添加项目成员。"""
    service.add_members(session, current_user, project_id, body.user_ids)


@router.patch("/{project_id}/members/{user_id}", status_code=204)
def update_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentSuperuser,
    body: MemberUpdate,
) -> None:
    """修改项目成员角色。"""
    service.update_member(session, current_user, project_id, user_id, body.role)


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> None:
    """移出项目成员；目标为当前用户时退出项目。"""
    service.remove_member(session, current_user, project_id, user_id)
