"""Orchestration layer: history + agent run + response shaping.

The HTTP layer talks to this service, never to the agent runner
directly - keeps routes thin and the service testable.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..agent.builder import AgentRunner
from ..agent.memory import ConversationStore
from ..config import Settings
from ..core.logging import get_logger

log = get_logger(__name__)


@dataclass
class ChatResponse:
    session_id: str
    answer: str
    charts: List[Dict[str, Any]] = field(default_factory=list)
    meta: Dict[str, Any] = field(default_factory=dict)


class ChatService:
    def __init__(self, settings: Settings, store: ConversationStore) -> None:
        self._settings = settings
        self._store = store
        self._runner = AgentRunner(settings)

    def ask(self, message: str, session_id: Optional[str] = None) -> ChatResponse:
        sid = self._store.ensure(session_id)
        history = self._store.get(sid)

        t0 = time.perf_counter()
        result = self._runner.run(message, history=history)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        self._store.append(sid, message, result.text)

        log.info(
            "chat: session=%s tool_calls=%d iterations=%d latency_ms=%d",
            sid,
            result.tool_calls,
            result.iterations,
            elapsed_ms,
        )

        return ChatResponse(
            session_id=sid,
            answer=result.text,
            charts=result.charts,
            meta={
                "tool_calls": result.tool_calls,
                "iterations": result.iterations,
                "latency_ms": elapsed_ms,
                "model": self._settings.active_model,
                "shop": self._settings.shopify_shop_name,
            },
        )

    def reset(self, session_id: str) -> None:
        self._store.reset(session_id)
