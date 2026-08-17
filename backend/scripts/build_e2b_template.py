from pathlib import Path

from e2b import Template, default_build_logger

from app.modules.agent.config import settings

template = (
    Template(file_context_path=Path(__file__).resolve().parents[2])
    .from_template("code-interpreter-v1")
    .copy(
        "backend/app/modules/agent/skills",
        "/skills/builtin",
        user="user",
    )
)

Template.build(
    template,
    settings.E2B_TEMPLATE,
    api_key=settings.E2B_API_KEY.get_secret_value(),
    on_build_logs=default_build_logger(),
)
