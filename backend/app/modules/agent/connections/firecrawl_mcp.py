from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from tenacity import retry, stop_after_attempt

from app.core.config import settings

FIRECRAWL_MCP_URL = "https://mcp.firecrawl.dev/v2/mcp"
ENABLED_TOOL_NAMES = {
    "firecrawl_search",
    "firecrawl_scrape",
}
_cached_tools: tuple[BaseTool, ...] | None = None


@retry(stop=stop_after_attempt(3))
async def load_firecrawl_mcp_tools() -> list[BaseTool]:
    global _cached_tools

    if _cached_tools is not None:
        return list(_cached_tools)

    client = MultiServerMCPClient(
        {
            "firecrawl": {
                "transport": "streamable_http",
                "url": FIRECRAWL_MCP_URL,
                "headers": {
                    "Authorization": (
                        f"Bearer {settings.FIRECRAWL_API_KEY.get_secret_value()}"
                    )
                },
            }
        }
    )

    tools = [
        tool for tool in await client.get_tools() if tool.name in ENABLED_TOOL_NAMES
    ]

    if {tool.name for tool in tools} != ENABLED_TOOL_NAMES:
        raise RuntimeError("Firecrawl 未提供所需的搜索和抓取工具")

    _cached_tools = tuple(tools)

    return list(_cached_tools)
