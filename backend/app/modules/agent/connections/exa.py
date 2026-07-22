from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from app.modules.agent.config import settings

EXA_MCP_URL = "https://mcp.exa.ai/mcp"


async def load_exa_tools() -> list[BaseTool]:
    client = MultiServerMCPClient(
        {
            "exa": {
                "transport": "streamable_http",
                "url": EXA_MCP_URL,
                "headers": {"x-api-key": settings.EXA_API_KEY.get_secret_value()},
            }
        }
    )

    tools = await client.get_tools()

    return tools
