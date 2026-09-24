from typing import Literal

from fastapi.routing import APIRoute

from app.api.openapi import custom_generate_unique_id
from app.mcp.operations import (
    BUSINESS_OPERATIONS,
    PROJECT_OPERATIONS,
    READ_ONLY_KNOWLEDGE_OPERATIONS,
)
from app.modules.knowledge.router import document_router as knowledge_document_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.mcp_keys.schemas import McpToolPublic

# 业务数据工具暂不对 MCP 开放；恢复时取消这些导入和 PROJECT_ROUTERS 中的注册。
# from app.modules.brand_marketing.router import router as brand_marketing_router
# from app.modules.content_operations.router import router as content_operations_router
# from app.modules.influencer_marketing.router import router as influencer_marketing_router

PROJECT_ROUTERS = (
    knowledge_router,
    knowledge_document_router,
    # brand_marketing_router,
    # content_operations_router,
    # influencer_marketing_router,
)


def project_tool_catalog() -> list[McpToolPublic]:
    # 从项目路由收集操作 ID 对应的接口描述。
    descriptions: dict[str, str] = {}

    for router in PROJECT_ROUTERS:
        for route in router.routes:
            if isinstance(route, APIRoute):
                descriptions[custom_generate_unique_id(route)] = (
                    route.description.strip()
                )

    # 仅为白名单中的操作生成工具及权限说明。
    tools: list[McpToolPublic] = []

    for operation_id, name in PROJECT_OPERATIONS.items():
        group: Literal["knowledge", "business"] = "knowledge"

        if operation_id in BUSINESS_OPERATIONS:
            group = "business"

        tools.append(
            McpToolPublic(
                name=name,
                description=descriptions[operation_id].rstrip("。"),
                group=group,
                read_only=operation_id in READ_ONLY_KNOWLEDGE_OPERATIONS,
            )
        )

    return tools
