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
from tenacity import retry, stop_after_attempt

from app.modules.agent.config import settings

LITELLM_MCP_URL = f"{settings.LITELLM_BASE_URL.removesuffix('/v1')}/mcp/"

NEW_API_TOOL_PREFIX = "new_api-"
NEW_API_TOOL_TIMEOUT_SECONDS = 600
NEW_API_TOOL_TIMEOUT_MESSAGE = "图片或视频生成超时，请稍后重试。"

XIAOHONGSHU_TOOL_PREFIX = "xiaohongshu-"
XIAOHONGSHU_MAX_CONCURRENT_TOOL_CALLS = 1
XIAOHONGSHU_TOOL_TIMEOUT_SECONDS = 300
XIAOHONGSHU_TOOL_TIMEOUT_MESSAGE = "小红书工具调用超时，请稍后重试。"

logger = logging.getLogger(__name__)
xiaohongshu_tool_semaphore = asyncio.Semaphore(XIAOHONGSHU_MAX_CONCURRENT_TOOL_CALLS)


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
        },
        tool_interceptors=[_limit_xiaohongshu_tool_call, _timeout_new_api_tool_call],
    )

    return await client.get_tools()


async def _timeout_new_api_tool_call(
    request: MCPToolCallRequest,
    handler: Callable[[MCPToolCallRequest], Awaitable[MCPToolCallResult]],
) -> MCPToolCallResult:
    if not request.name.startswith(NEW_API_TOOL_PREFIX):
        return await handler(request)

    try:
        async with asyncio.timeout(NEW_API_TOOL_TIMEOUT_SECONDS):
            return await handler(request)
    except TimeoutError as error:
        logger.warning("New API tool call timed out: %s", request.name)
        raise ToolException(NEW_API_TOOL_TIMEOUT_MESSAGE) from error


async def _limit_xiaohongshu_tool_call(
    request: MCPToolCallRequest,
    handler: Callable[[MCPToolCallRequest], Awaitable[MCPToolCallResult]],
) -> MCPToolCallResult:
    if not request.name.startswith(XIAOHONGSHU_TOOL_PREFIX):
        return await handler(request)

    try:
        async with asyncio.timeout(XIAOHONGSHU_TOOL_TIMEOUT_SECONDS):
            async with xiaohongshu_tool_semaphore:
                return await handler(request)
    except TimeoutError as error:
        logger.warning("Xiaohongshu tool call timed out: %s", request.name)
        raise ToolException(XIAOHONGSHU_TOOL_TIMEOUT_MESSAGE) from error
