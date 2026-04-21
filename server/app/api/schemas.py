"""Pydantic models for the public HTTP contract."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = Field(
        default=None,
        description="Opaque session token returned from a prior /chat call. "
        "Omit to start a fresh conversation.",
    )
    # Optional override - the frontend can display which store is being
    # queried, but we do NOT allow switching stores at runtime (creds
    # come from the server-side .env).
    store_url: Optional[str] = Field(default=None, max_length=200)


class Chart(BaseModel):
    id: str
    title: str
    mime: str = "image/png"
    data_base64: str


class ChatMeta(BaseModel):
    tool_calls: int
    iterations: int
    latency_ms: int
    model: str
    shop: str


class ChatResponseModel(BaseModel):
    session_id: str
    answer: str
    charts: List[Chart] = Field(default_factory=list)
    meta: ChatMeta


class ResetRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=64)


class HealthResponse(BaseModel):
    status: str = "ok"
    shop: str
    model: str
    version: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None

    # Free-form hints (e.g. retry_after)
    extra: Optional[Dict[str, Any]] = None
