from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

EXA_MCP_URL = "https://mcp.exa.ai/mcp"


async def load_exa_tools() -> list[BaseTool]:
    client = MultiServerMCPClient(
        {
            "exa": {
                "transport": "streamable_http",
                "url": EXA_MCP_URL,
            }
        }
    )

    tools = await client.get_tools()

    return tools
