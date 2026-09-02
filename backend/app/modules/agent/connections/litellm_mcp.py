from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from tenacity import retry, stop_after_attempt

from app.modules.agent.config import settings

LITELLM_MCP_URL = f"{settings.LITELLM_BASE_URL.removesuffix('/v1')}/mcp/"
_cached_tools: tuple[BaseTool, ...] | None = None


@retry(stop=stop_after_attempt(3))
async def load_litellm_mcp_tools() -> list[BaseTool]:
    global _cached_tools

    if _cached_tools is not None:
        return list(_cached_tools)

    client = MultiServerMCPClient(
        {
            "litellm": {
                "transport": "streamable_http",
                "url": LITELLM_MCP_URL,
                "headers": {
                    "x-litellm-api-key": (
                        f"Bearer {settings.LITELLM_API_KEY.get_secret_value()}"
                    )
                },
            }
        }
    )

    tools = await client.get_tools()

    _cached_tools = tuple(tools)

    return list(_cached_tools)
