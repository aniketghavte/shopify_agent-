"""In-process chat-history store keyed by session id.

Minimal on purpose - swap for Redis / SQL if you need persistence.
Thread-safe, and bounded so a long session can't eat unbounded memory.
"""

from __future__ import annotations

import threading
import uuid
from collections import deque
from typing import Deque, Dict, List, Tuple

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

# Cap on how much history we replay to the LLM each turn. Gemini handles
# long context fine but replaying 100 turns is wasteful and slow.
_MAX_TURNS = 20


class ConversationStore:
    """Thread-safe in-memory store of (session_id -> message deque)."""

    def __init__(self, max_turns: int = _MAX_TURNS) -> None:
        self._sessions: Dict[str, Deque[BaseMessage]] = {}
        self._lock = threading.Lock()
        self._max_turns = max_turns

    def create_session(self) -> str:
        sid = uuid.uuid4().hex
        with self._lock:
            self._sessions[sid] = deque(maxlen=self._max_turns * 2)
        return sid

    def ensure(self, session_id: str | None) -> str:
        if session_id and session_id in self._sessions:
            return session_id
        return self.create_session()

    def reset(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def get(self, session_id: str) -> List[BaseMessage]:
        with self._lock:
            return list(self._sessions.get(session_id, []))

    def append(self, session_id: str, user_text: str, agent_text: str) -> None:
        with self._lock:
            buf = self._sessions.setdefault(
                session_id, deque(maxlen=self._max_turns * 2)
            )
            buf.append(HumanMessage(content=user_text))
            buf.append(AIMessage(content=agent_text))

    def snapshot(self) -> List[Tuple[str, int]]:
        """[(session_id, message_count), ...] - handy for debugging."""
        with self._lock:
            return [(sid, len(msgs)) for sid, msgs in self._sessions.items()]
