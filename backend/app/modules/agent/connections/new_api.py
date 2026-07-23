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

from app.modules.agent.config import settings

NEW_API_MCP_URL = "http://43.139.210.125:18888/mcp"
NEW_API_TOOL_TIMEOUT_SECONDS = 600
NEW_API_TOOL_TIMEOUT_MESSAGE = "图片或视频生成超时，请稍后重试。"
logger = logging.getLogger(__name__)


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
        },
        tool_interceptors=[_timeout_new_api_tool_call],
    )

    return await client.get_tools()


async def _timeout_new_api_tool_call(
    request: MCPToolCallRequest,
    handler: Callable[[MCPToolCallRequest], Awaitable[MCPToolCallResult]],
) -> MCPToolCallResult:
    try:
        async with asyncio.timeout(NEW_API_TOOL_TIMEOUT_SECONDS):
            return await handler(request)
    except TimeoutError as error:
        logger.warning("图片或视频工具调用超时: %s", request.name)
        raise ToolException(NEW_API_TOOL_TIMEOUT_MESSAGE) from error
