import asyncio
import mimetypes
from pathlib import PurePosixPath
from urllib.parse import quote
from uuid import uuid4

from langchain_core.tools import BaseTool, tool
from langgraph.prebuilt import ToolRuntime
from qcloud_cos import CosConfig, CosS3Client  # type: ignore[import-untyped]

from app.modules.agent.config import AgentSettings
from app.modules.agent.sandbox import SANDBOX_WORKDIR, get_sandbox

ARTIFACT_DIRECTORY = PurePosixPath(SANDBOX_WORKDIR) / "artifacts"
COS_ARTIFACT_PREFIX = "agent-artifacts"


def load_publish_artifact_tools(settings: AgentSettings) -> list[BaseTool]:
    cos_client = CosS3Client(
        CosConfig(
            Region=settings.COS_REGION,
            SecretId=settings.COS_SECRET_ID.get_secret_value(),
            SecretKey=settings.COS_SECRET_KEY.get_secret_value(),
        )
    )

    @tool("publish_artifact")
    async def publish_artifact(path: str, runtime: ToolRuntime) -> dict[str, str]:
        """将 /workspace/artifacts/ 下的最终文件发布为可下载链接。"""
        artifact_path = PurePosixPath(path)

        if artifact_path.parent != ARTIFACT_DIRECTORY or artifact_path.name in {
            "",
            ".",
            "..",
        }:
            raise ValueError("只能发布 /workspace/artifacts/ 目录中的单个文件")

        thread_id = runtime.config["configurable"]["thread_id"]

        if not isinstance(thread_id, str):
            raise ValueError("缺少会话标识")

        sandbox = await asyncio.to_thread(get_sandbox, thread_id)
        downloaded = await asyncio.to_thread(
            sandbox.download_files, [str(artifact_path)]
        )
        file = downloaded[0]

        if file.error is not None or file.content is None:
            raise ValueError(f"无法读取产物文件：{file.error or path}")

        object_key = "/".join(
            [
                COS_ARTIFACT_PREFIX,
                uuid4().hex,
                artifact_path.name,
            ]
        )
        content_type = mimetypes.guess_type(artifact_path.name)[0]

        await asyncio.to_thread(
            cos_client.put_object,
            Bucket=settings.COS_BUCKET,
            Key=object_key,
            Body=file.content,
            ContentType=content_type or "application/octet-stream",
        )
        url = (
            f"https://{settings.COS_BUCKET}.cos.{settings.COS_REGION}.myqcloud.com/"
            f"{quote(object_key, safe='/')}"
        )

        return {
            "name": artifact_path.name,
            "url": url,
        }

    return [publish_artifact]
