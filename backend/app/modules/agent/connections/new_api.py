from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from app.modules.agent.config import settings

NEW_API_MCP_URL = "http://43.139.210.125:18888/mcp"


async def load_new_api_tools() -> list[BaseTool]:
    client = MultiServerMCPClient(
        {
            "new-api-mcp": {
                "transport": "streamable_http",
                "url": NEW_API_MCP_URL,
                "headers": {
                    "Authorization": (
                        "Bearer "
                        f"{settings.NEW_API_MCP_API_KEY.get_secret_value()}"
                    )
                },
            }
        }
    )

    return await client.get_tools()
