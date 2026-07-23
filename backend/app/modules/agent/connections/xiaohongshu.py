from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

XIAOHONGSHU_MCP_URL = "http://xiaohongshu-mcp:18060/mcp"


async def load_xiaohongshu_tools() -> list[BaseTool]:
    client = MultiServerMCPClient(
        {
            "xiaohongshu": {
                "transport": "streamable_http",
                "url": XIAOHONGSHU_MCP_URL,
            }
        }
    )

    return await client.get_tools()
