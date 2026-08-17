import asyncio
from pathlib import Path
from typing import Any

from langchain.agents.middleware import AgentMiddleware
from langgraph.config import get_config
from langgraph.runtime import Runtime

from app.modules.agent.sandbox import get_sandbox
from app.modules.skills import service as skill_service

BUILTIN_SKILLS_DIRECTORY = Path(__file__).parent / "skills"
BUILTIN_SKILLS_PATH = "/skills/builtin/"
USER_SKILLS_PATH = "/skills/user/"
SKILL_SYNC_MARKER_PATH = "/skills/.synced"
USER_SKILLS_DIRECTORY = USER_SKILLS_PATH.rstrip("/")


class SkillSandboxMiddleware(AgentMiddleware[Any, Any, Any]):
    async def abefore_agent(
        self,
        _state: Any,
        runtime: Runtime[Any],
    ) -> None:
        if runtime.store is None:
            raise RuntimeError("Agent Store 未初始化")

        thread_id = str(get_config()["configurable"]["thread_id"])

        sandbox = await asyncio.to_thread(get_sandbox, thread_id)

        user_skills_version = await skill_service.get_user_skills_version(
            store=runtime.store,
            user_id=runtime.context["user_id"],
        )

        desired_version = user_skills_version.encode()

        marker = (await sandbox.adownload_files([SKILL_SYNC_MARKER_PATH]))[0]

        if marker.error is None and marker.content == desired_version:
            return

        if marker.error not in {None, "file_not_found"}:
            raise RuntimeError("无法检查沙箱 Skill 状态")

        user_skill_files = await skill_service.download_user_skill_files(
            store=runtime.store,
            user_id=runtime.context["user_id"],
        )

        skill_files = [
            (f"{USER_SKILLS_DIRECTORY}{path}", content)
            for path, content in user_skill_files
        ]

        reset = await sandbox.aexecute(
            f"rm -rf -- {USER_SKILLS_DIRECTORY} && mkdir -p -- {USER_SKILLS_DIRECTORY}"
        )

        if reset.exit_code != 0:
            raise RuntimeError("无法重置沙箱 Skill 目录")

        uploads = await sandbox.aupload_files(skill_files)

        for upload in uploads:
            if upload.error is not None:
                raise RuntimeError("无法同步 Skill 到沙箱")

        marker_upload = (
            await sandbox.aupload_files([(SKILL_SYNC_MARKER_PATH, desired_version)])
        )[0]

        if marker_upload.error is not None:
            raise RuntimeError("无法同步 Skill 到沙箱")
