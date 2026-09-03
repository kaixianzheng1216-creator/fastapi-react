import json
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

from langchain.agents import create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.config import get_config
from langgraph.graph import END, START, StateGraph, add_messages
from langgraph.runtime import Runtime
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db.session import engine
from app.modules.agent.agent import (
    AgentContext,
    create_chat_model,
    select_chat_model,
)
from app.modules.agent.connections.litellm_mcp import load_litellm_mcp_tools
from app.modules.agent.file_messages import prepare_message_file_inputs

PROMPTS = Path(__file__).parent / "prompts" / "research.md"
RESEARCH_TOOL_NAMES = {
    "firecrawl-firecrawl_search",
    "firecrawl-firecrawl_scrape",
}
PLAN_PROMPT, RESEARCH_PROMPT, OUTLINE_PROMPT, DRAFT_PROMPT, FINAL_PROMPT = (
    PROMPTS.read_text(encoding="utf-8")
    .strip()
    .split("\n\n<!-- ===== NEXT PROMPT ===== -->\n\n")
)


class ResearchPeriod(TypedDict):
    start: str
    end: str


class ResearchPlanData(TypedDict):
    intent: str
    period: ResearchPeriod | None
    questions: list[str]
    metrics: list[str]


class ResearchPlan(BaseModel):
    intent: str = Field(description="明确调研目标")
    period: ResearchPeriod | None = Field(
        default=None,
        description="研究起止日期；无法确定则为 null",
    )
    questions: list[str] = Field(
        min_length=4,
        max_length=6,
        description="必须回答的核心问题",
    )
    metrics: list[str] = Field(
        max_length=8,
        description="支撑核心问题的候选量化指标",
    )


class ResearchState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    as_of: str
    stage: Literal[
        "plan",
        "research",
        "outline",
        "draft",
        "finalize",
        "complete",
    ]
    plan: ResearchPlanData
    research_messages: list[dict[str, Any]]
    outline: str
    draft: str
    report: str


def _user_message(
    messages: list[BaseMessage], runtime: Runtime[AgentContext]
) -> BaseMessage:
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            with Session(engine) as session:
                return prepare_message_file_inputs(
                    message,
                    runtime.context["user_id"],
                    session,
                    runtime.context["supports_vision"],
                )

    raise ValueError("调研任务缺少用户消息")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _input(**parts: Any) -> str:
    blocks: list[str] = []

    for name, value in parts.items():
        if isinstance(value, str):
            content = value
        else:
            content = _json(value)

        block = f"## {name}\n{content}"
        blocks.append(block)

    return "\n\n".join(blocks)


def format_research(messages: list[dict[str, Any]]) -> str:
    blocks: list[str] = []

    for message in messages:
        if message["type"] == "ai":
            for call in message["tool_calls"]:
                blocks.append(
                    f"[工具调用]\n工具：{call['name']}\n参数：{_json(call['args'])}"
                )

        elif message["type"] == "tool":
            name = message["name"]

            if not name:
                name = "unknown"

            content = message["content"]

            if not isinstance(content, str):
                content = _json(content)

            blocks.append(f"[工具结果]\n工具：{name}\n内容：{content}")

    return "\n\n".join(blocks)


def _model(runtime: Runtime[AgentContext]) -> BaseChatModel:
    context = runtime.context

    if context["supports_thinking"]:
        thinking_enabled = context["thinking_enabled"]
    else:
        thinking_enabled = None

    return create_chat_model(
        model_name=context["model_name"],
        thinking_enabled=thinking_enabled,
    )


async def create_research_graph(
    checkpointer: AsyncPostgresSaver,
) -> Any:
    tools = await load_litellm_mcp_tools()

    research_tools = [tool for tool in tools if tool.name in RESEARCH_TOOL_NAMES]

    research_agent = create_agent(
        model=create_chat_model(),
        tools=research_tools,
        middleware=[select_chat_model],
        system_prompt=RESEARCH_PROMPT,
        context_schema=AgentContext,
        name="research_agent",
    )

    async def plan_node(
        state: ResearchState,
        runtime: Runtime[AgentContext],
    ) -> dict[str, Any]:
        planner = _model(runtime).with_structured_output(ResearchPlan)

        plan = await planner.ainvoke(
            [
                SystemMessage(PLAN_PROMPT),
                _user_message(state["messages"], runtime),
                HumanMessage(
                    _input(
                        当前日期=state["as_of"],
                    )
                ),
            ]
        )

        if not isinstance(plan, ResearchPlan):
            raise TypeError("调研计划返回类型错误，预期为 ResearchPlan")

        return {
            "plan": plan.model_dump(mode="json"),
            "stage": "research",
        }

    async def research_node(
        state: ResearchState,
        runtime: Runtime[AgentContext],
    ) -> dict[str, Any]:
        research_input: Any = {
            "messages": [
                _user_message(state["messages"], runtime),
                HumanMessage(
                    _input(
                        当前日期=state["as_of"],
                        调研计划=state["plan"],
                    )
                ),
            ]
        }

        result = await research_agent.ainvoke(
            research_input,
            config=get_config(),
            context=runtime.context,
        )

        messages = []

        for message in result["messages"]:
            messages.append(message.model_dump(mode="json"))

        return {
            "research_messages": messages,
            "stage": "outline",
        }

    async def outline_node(
        state: ResearchState,
        runtime: Runtime[AgentContext],
    ) -> dict[str, str]:
        response = await _model(runtime).ainvoke(
            [
                SystemMessage(OUTLINE_PROMPT),
                _user_message(state["messages"], runtime),
                HumanMessage(
                    _input(
                        调研计划=state["plan"],
                        工具调用输出=format_research(state["research_messages"]),
                    )
                ),
            ]
        )

        return {"outline": response.text, "stage": "draft"}

    async def draft_node(
        state: ResearchState,
        runtime: Runtime[AgentContext],
    ) -> dict[str, str]:
        response = await _model(runtime).ainvoke(
            [
                SystemMessage(DRAFT_PROMPT),
                _user_message(state["messages"], runtime),
                HumanMessage(
                    _input(
                        调研计划=state["plan"],
                        工具调用输出=format_research(state["research_messages"]),
                        报告大纲=state["outline"],
                    )
                ),
            ]
        )

        return {"draft": response.text, "stage": "finalize"}

    async def finalize_node(
        state: ResearchState,
        runtime: Runtime[AgentContext],
    ) -> dict[str, str]:
        response = await _model(runtime).ainvoke(
            [
                SystemMessage(FINAL_PROMPT),
                _user_message(state["messages"], runtime),
                HumanMessage(
                    _input(
                        调研计划=state["plan"],
                        工具调用输出=format_research(state["research_messages"]),
                        报告大纲=state["outline"],
                        报告初稿=state["draft"],
                    )
                ),
            ]
        )

        return {"report": response.text, "stage": "complete"}

    graph = StateGraph(ResearchState, context_schema=AgentContext)

    graph.add_node("plan", plan_node)
    graph.add_node("research", research_node)
    graph.add_node("outline", outline_node)
    graph.add_node("draft", draft_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "plan")
    graph.add_edge("plan", "research")
    graph.add_edge("research", "outline")
    graph.add_edge("outline", "draft")
    graph.add_edge("draft", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=checkpointer, name="research")
