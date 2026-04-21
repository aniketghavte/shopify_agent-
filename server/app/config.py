"""Typed application settings, loaded from env / .env files."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root (two levels up from this file: app/config.py -> app -> server -> repo)
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SERVER_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Application settings.

    Read from (in priority order):
        1. Process environment variables
        2. server/.env
        3. Repo-root .env (where the assignment ships credentials)
    """

    # Shopify
    shopify_shop_name: str = Field(..., description="e.g. clevrr-test.myshopify.com")
    shopify_api_version: str = Field(default="2025-07")
    shopify_access_token: SecretStr = Field(..., description="Shopify Admin API access token")

    # LLM provider
    llm_provider: Literal["gemini", "openai"] = Field(
        default="gemini",
        description="Which model provider to use for the agent.",
    )

    # Gemini
    google_api_key: SecretStr | None = Field(
        default=None, description="Google AI Studio key"
    )
    gemini_model: str = Field(default="gemini-2.5-flash")

    # OpenAI
    openai_api_key: SecretStr | None = Field(default=None, description="OpenAI API key")
    openai_model: str = Field(default="gpt-4o-mini")

    # HTTP server
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)
    log_level: str = Field(default="INFO")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,https://shopify-agent-eosin.vercel.app/",
        description="Comma-separated list of allowed origins.",
    )

    # Agent tuning
    agent_max_iterations: int = Field(default=12, ge=1, le=50)
    agent_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    shopify_max_pages: int = Field(default=10, ge=1, le=100)
    shopify_default_page_size: int = Field(default=100, ge=1, le=250)
    shopify_request_timeout_seconds: float = Field(default=30.0, ge=1.0, le=300.0)

    model_config = SettingsConfigDict(
        # Server-level .env wins over repo-root fallback
        env_file=(_REPO_ROOT / ".env", _SERVER_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("shopify_shop_name")
    @classmethod
    def _normalize_shop(cls, v: str) -> str:
        v = (v or "").strip().lower().removeprefix("https://").removeprefix("http://")
        v = v.rstrip("/")
        if not v:
            raise ValueError("SHOPIFY_SHOP_NAME is required")
        if "." not in v:
            v = f"{v}.myshopify.com"
        return v

    @property
    def shopify_base_url(self) -> str:
        return f"https://{self.shopify_shop_name}/admin/api/{self.shopify_api_version}"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _validate_provider_keys(self) -> "Settings":
        if self.llm_provider == "gemini":
            if self.google_api_key is None:
                raise ValueError(
                    "GOOGLE_API_KEY is required when LLM_PROVIDER=gemini."
                )
        elif self.llm_provider == "openai":
            if self.openai_api_key is None:
                raise ValueError(
                    "OPENAI_API_KEY is required when LLM_PROVIDER=openai."
                )
        return self

    @property
    def active_model(self) -> str:
        return self.openai_model if self.llm_provider == "openai" else self.gemini_model


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton accessor for settings."""
    return Settings()  # type: ignore[call-arg]
