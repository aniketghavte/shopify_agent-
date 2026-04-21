"""FastAPI application entrypoint.

Run locally:

    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

Or from server/:

    python -m app.main
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .agent.memory import ConversationStore
from .api.routes import router
from .config import get_settings
from .core.exceptions import AppError
from .core.logging import configure_logging, get_logger
from .services.chat_service import ChatService


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    log = get_logger("app.startup")
    log.info(
        "Starting Shopify Agent v%s (shop=%s, provider=%s, model=%s)",
        __version__,
        settings.shopify_shop_name,
        settings.llm_provider,
        settings.active_model,
    )
    store = ConversationStore()
    app.state.chat_service = ChatService(settings, store)
    app.state.settings = settings
    try:
        yield
    finally:
        log.info("Shutting down Shopify Agent")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Shopify Insight Agent",
        version=__version__,
        description="AI agent that analyses a Shopify store via read-only Admin REST calls.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.exception_handler(AppError)
    async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.public_message, "detail": str(exc)},
        )

    app.include_router(router)
    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    s = get_settings()
    uvicorn.run(
        "app.main:app",
        host=s.host,
        port=s.port,
        reload=False,
        log_level=s.log_level.lower(),
    )
