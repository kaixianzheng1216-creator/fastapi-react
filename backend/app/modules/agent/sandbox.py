import hashlib

import e2b
from langchain_e2b import E2BSandbox  # type: ignore[import-untyped]

from app.modules.agent.config import settings

SANDBOX_WORKDIR = "/home/user"
THREAD_METADATA_KEY = "agent_thread"
SANDBOX_TIMEOUT_SECONDS = 300


def get_sandbox(thread_id: str) -> E2BSandbox:
    api_key = settings.E2B_API_KEY.get_secret_value()
    metadata = {THREAD_METADATA_KEY: hashlib.sha256(thread_id.encode()).hexdigest()}
    paginator = e2b.Sandbox.list(
        query=e2b.SandboxQuery(metadata=metadata),
        limit=1,
        api_key=api_key,
    )
    sandboxes = paginator.next_items() if paginator.has_next else []

    if sandboxes:
        sandbox = e2b.Sandbox.connect(
            sandboxes[0].sandbox_id,
            timeout=SANDBOX_TIMEOUT_SECONDS,
            api_key=api_key,
        )

        sandbox.set_timeout(SANDBOX_TIMEOUT_SECONDS)
    else:
        sandbox = e2b.Sandbox.create(
            template=settings.E2B_TEMPLATE,
            timeout=SANDBOX_TIMEOUT_SECONDS,
            metadata=metadata,
            lifecycle={"on_timeout": "kill"},
            api_key=api_key,
        )

        setup = sandbox.commands.run("mkdir -p /home/user/artifacts")

        if setup.exit_code != 0:
            raise RuntimeError(f"无法初始化沙箱工作目录：{setup.stderr}")

    return E2BSandbox(sandbox=sandbox, workdir=SANDBOX_WORKDIR)
