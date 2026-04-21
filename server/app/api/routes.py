"""HTTP route handlers.

Keep handlers thin: parse the request, hand off to the service,
translate domain exceptions into HTTP responses, return.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from .. import __version__
from ..config import Settings, get_settings
from ..core.exceptions import AppError
from ..core.logging import get_logger
from ..services.chat_service import ChatService
from .schemas import (
    ChatRequest,
    ChatResponseModel,
    Chart,
    ErrorResponse,
    HealthResponse,
    ResetRequest,
)

log = get_logger(__name__)

router = APIRouter()


def _service(request: Request) -> ChatService:
    """Pull the process-wide ChatService off app.state."""
    svc: ChatService = request.app.state.chat_service
    return svc


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        shop=settings.shopify_shop_name,
        model=settings.active_model,
        version=__version__,
    )


@router.post(
    "/chat",
    response_model=ChatResponseModel,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
    },
    tags=["chat"],
)
def chat(payload: ChatRequest, request: Request) -> ChatResponseModel:
    svc = _service(request)
    try:
        resp = svc.ask(payload.message, session_id=payload.session_id)
    except AppError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={"error": e.public_message, "detail": str(e)},
        ) from e
    except Exception as e:
        log.exception("Unhandled error in /chat")
        raise HTTPException(
            status_code=500,
            detail={"error": "Internal server error"},
        ) from e

    return ChatResponseModel(
        session_id=resp.session_id,
        answer=resp.answer,
        charts=[Chart(**c) for c in resp.charts],
        meta=resp.meta,  # type: ignore[arg-type]
    )


@router.post("/chat/reset", tags=["chat"])
def reset(payload: ResetRequest, request: Request) -> dict:
    _service(request).reset(payload.session_id)
    return {"ok": True}
