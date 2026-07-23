import asyncio
import logging
from collections.abc import Awaitable, Callable

from langchain_core.tools import BaseTool
from langchain_core.tools.base import ToolException
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import (
    MCPToolCallRequest,
    MCPToolCallResult,
)

XIAOHONGSHU_MCP_URL = "http://xiaohongshu-mcp:18060/mcp"
XIAOHONGSHU_MAX_CONCURRENT_TOOL_CALLS = 1
XIAOHONGSHU_TOOL_TIMEOUT_SECONDS = 60
XIAOHONGSHU_TOOL_TIMEOUT_MESSAGE = "小红书工具调用超时，请稍后重试。"
logger = logging.getLogger(__name__)
_xiaohongshu_tool_semaphore = asyncio.Semaphore(
    XIAOHONGSHU_MAX_CONCURRENT_TOOL_CALLS
)


async def load_xiaohongshu_tools() -> list[BaseTool]:
    client = MultiServerMCPClient(
        {
            "xiaohongshu": {
                "transport": "streamable_http",
                "url": XIAOHONGSHU_MCP_URL,
            }
        },
        tool_interceptors=[_limit_xiaohongshu_tool_call],
    )

    return await client.get_tools()


async def _limit_xiaohongshu_tool_call(
    request: MCPToolCallRequest,
    handler: Callable[[MCPToolCallRequest], Awaitable[MCPToolCallResult]],
) -> MCPToolCallResult:
    try:
        async with asyncio.timeout(XIAOHONGSHU_TOOL_TIMEOUT_SECONDS):
            async with _xiaohongshu_tool_semaphore:
                return await handler(request)
    except TimeoutError as error:
        logger.warning("小红书工具调用超时: %s", request.name)
        raise ToolException(XIAOHONGSHU_TOOL_TIMEOUT_MESSAGE) from error
