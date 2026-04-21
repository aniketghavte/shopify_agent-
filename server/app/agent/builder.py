"""Build + run a LangGraph ReAct agent for a single request.

We rebuild the graph per request so each request has its own
ShopifyClient + PythonAstREPLTool locals. Otherwise the chart-capture
list would bleed across concurrent requests.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from ..config import Settings
from ..core.exceptions import AgentError
from ..core.logging import get_logger
from ..tools.python_repl import build_python_tool
from ..tools.shopify_client import ShopifyClient
from ..tools.shopify_tools import build_shopify_tools
from .prompts import build_system_prompt

log = get_logger(__name__)


@dataclass
class AgentRunResult:
    text: str
    charts: List[Dict[str, Any]]
    tool_calls: int
    iterations: int


class AgentRunner:
    """Builds and runs a fresh agent graph per call."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def _build_llm(self) -> BaseChatModel:
        if self._settings.llm_provider == "openai":
            assert self._settings.openai_api_key is not None
            return ChatOpenAI(
                model=self._settings.openai_model,
                api_key=self._settings.openai_api_key.get_secret_value(),
                temperature=self._settings.agent_temperature,
                max_retries=2,
                timeout=60,
            )

        # Default: Gemini
        assert self._settings.google_api_key is not None
        return ChatGoogleGenerativeAI(
            model=self._settings.gemini_model,
            google_api_key=self._settings.google_api_key.get_secret_value(),
            temperature=self._settings.agent_temperature,
            max_retries=2,
            timeout=60,
        )

    def run(
        self,
        user_message: str,
        history: Optional[List[BaseMessage]] = None,
    ) -> AgentRunResult:
        """Run the agent and return the final text + any charts."""
        if not user_message or not user_message.strip():
            raise AgentError("Empty user message.")

        shopify_tools, shopify_client = build_shopify_tools(self._settings)
        python_tool, charts = build_python_tool()
        tools = shopify_tools + [python_tool]

        llm = self._build_llm()
        system_prompt = build_system_prompt(self._settings.shopify_shop_name)

        # TODO: pass shop timezone into the prompt once we fetch it from
        # /shop on startup. For now the agent figures it out on its own.
        graph = create_react_agent(llm, tools)

        messages: List[BaseMessage] = [SystemMessage(content=system_prompt)]
        if history:
            messages.extend(history)
        messages.append(_human(user_message))

        try:
            result = graph.invoke(
                {"messages": messages},
                config={"recursion_limit": self._settings.agent_max_iterations * 2},
            )
        except Exception as e:
            log.exception("Agent graph invocation failed")
            raise AgentError(f"Agent failed: {e}") from e
        finally:
            shopify_client.close()

        final_messages: List[BaseMessage] = result.get("messages", [])
        final_text = _extract_final_text(final_messages)
        tool_calls = _count_tool_calls(final_messages)

        return AgentRunResult(
            text=final_text,
            charts=list(charts),  # copy since the caller may mutate the response
            tool_calls=tool_calls,
            iterations=len(final_messages),
        )


def _human(text: str) -> BaseMessage:
    from langchain_core.messages import HumanMessage

    return HumanMessage(content=text)


def _extract_final_text(messages: List[BaseMessage]) -> str:
    """Pull the last AIMessage with non-empty text content."""
    for m in reversed(messages):
        if isinstance(m, AIMessage):
            content = m.content
            if isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(content, list):
                # Gemini sometimes returns a list of content-part dicts
                parts = [p.get("text", "") for p in content if isinstance(p, dict)]
                text = "".join(parts).strip()
                if text:
                    return text
    return "I couldn't produce a response. Please try rephrasing."


def _count_tool_calls(messages: List[BaseMessage]) -> int:
    n = 0
    for m in messages:
        tool_calls = getattr(m, "tool_calls", None) or []
        n += len(tool_calls)
    return n
