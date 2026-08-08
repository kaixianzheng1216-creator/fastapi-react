from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from tenacity import retry, stop_after_attempt

from app.modules.agent.config import settings

LITELLM_MCP_URL = f"{settings.LITELLM_BASE_URL.removesuffix('/v1')}/mcp/"


@retry(stop=stop_after_attempt(3))
async def load_litellm_mcp_tools() -> list[BaseTool]:
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

    return await client.get_tools()
