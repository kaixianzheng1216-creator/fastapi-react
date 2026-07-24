from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from tenacity import retry, stop_after_attempt, wait_exponential

from app.modules.agent.config import settings

FIRECRAWL_MCP_URL = "https://mcp.firecrawl.dev/v2/mcp"
FIRECRAWL_TOOL_NAMES = {"firecrawl_search", "firecrawl_scrape"}


@retry(stop=stop_after_attempt(3))
async def load_firecrawl_tools() -> list[BaseTool]:
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

    tools = await client.get_tools()

    return [tool for tool in tools if tool.name in FIRECRAWL_TOOL_NAMES]
