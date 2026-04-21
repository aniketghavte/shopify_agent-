"""Shopify Admin REST client.

GET-only, path-whitelisted, with backoff on 429/5xx and cursor-based
pagination via the Link header.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import parse_qs, urlparse

import httpx

from ..config import Settings
from ..core.exceptions import (
    ShopifyAuthError,
    ShopifyError,
    ShopifyRateLimitError,
    UnsafeOperationError,
)
from ..core.logging import get_logger

log = get_logger(__name__)

# Paths the agent is allowed to read. Keeping this tight keeps the tool
# focused on the assignment scope and avoids random endpoint usage.
# TODO: add "fulfillments" if we ever need per-order fulfillment detail.
_ALLOWED_PATH_PREFIXES = (
    "orders",
    "orders/count",
    "products",
    "products/count",
    "customers",
    "customers/count",
    "customers/search",
    "shop",
    "inventory_items",
    "inventory_levels",
    "locations",
    "collects",
    "custom_collections",
    "smart_collections",
    "price_rules",
    "discount_codes",
)

_LINK_RE = re.compile(r'<([^>]+)>;\s*rel="([^"]+)"')


@dataclass
class ShopifyPage:
    """A single page of results from a Shopify list endpoint."""

    data: Any
    next_page_info: Optional[str] = None
    status_code: int = 200
    headers: Mapping[str, str] = field(default_factory=dict)


class ShopifyClient:
    """Thin wrapper around httpx.Client for the Admin API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._base_url = settings.shopify_base_url
        self._timeout = settings.shopify_request_timeout_seconds
        self._client = httpx.Client(
            base_url=self._base_url,
            timeout=self._timeout,
            headers={
                "X-Shopify-Access-Token": settings.shopify_access_token.get_secret_value(),
                "Accept": "application/json",
                "User-Agent": "shopify-agent/1.0",
            },
        )

    # ---- Public API ----

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "ShopifyClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        *,
        max_retries: int = 5,
    ) -> ShopifyPage:
        """GET a single page from the Admin API."""
        self._validate_path(path)
        url = self._build_url(path)
        return self._request_with_retry(url, params=params, max_retries=max_retries)

    def get_all(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        *,
        max_pages: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Follow Link: rel="next" pages and aggregate results."""
        max_pages = max_pages or self._settings.shopify_max_pages
        page_params: Dict[str, Any] = dict(params or {})
        page_params.setdefault("limit", self._settings.shopify_default_page_size)

        merged: List[Any] = []
        resource_key: Optional[str] = None
        pages = 0
        next_cursor: Optional[str] = None

        while pages < max_pages:
            if next_cursor:
                # page_info can't combine with other filters
                page_params = {"limit": page_params.get("limit"), "page_info": next_cursor}

            page = self.get(path, params=page_params)
            payload = page.data if isinstance(page.data, dict) else {}
            if resource_key is None:
                resource_key = next(
                    (k for k, v in payload.items() if isinstance(v, list)),
                    None,
                )

            if resource_key and isinstance(payload.get(resource_key), list):
                merged.extend(payload[resource_key])
            else:
                # Non-list payload (e.g. /count)
                return {**payload, "pages_fetched": 1, "truncated": False}

            pages += 1
            next_cursor = page.next_page_info
            if not next_cursor:
                break

        truncated = bool(next_cursor) and pages >= max_pages
        return {
            resource_key or "items": merged,
            "count": len(merged),
            "pages_fetched": pages,
            "truncated": truncated,
        }

    # ---- Internals ----

    def _validate_path(self, path: str) -> None:
        if not isinstance(path, str):
            raise UnsafeOperationError("Shopify path must be a string.")
        clean = path.strip().lstrip("/")
        if not clean:
            raise UnsafeOperationError("Shopify path cannot be empty.")
        if "://" in clean or clean.startswith("//"):
            raise UnsafeOperationError("Absolute URLs are not permitted.")
        head = clean.split("?", 1)[0].rstrip("/")
        head = head.removesuffix(".json")
        if not any(
            head == p or head.startswith(p + "/") for p in _ALLOWED_PATH_PREFIXES
        ):
            raise UnsafeOperationError(
                f"Path '{head}' is not in the allowed read-only whitelist."
            )

    def _build_url(self, path: str) -> str:
        clean = path.strip().lstrip("/").removesuffix(".json")
        return f"/{clean}.json"

    def _request_with_retry(
        self,
        url: str,
        *,
        params: Optional[Dict[str, Any]],
        max_retries: int,
    ) -> ShopifyPage:
        attempt = 0
        backoff = 1.0
        while True:
            attempt += 1
            try:
                resp = self._client.get(url, params=params)
            except httpx.TimeoutException as e:
                if attempt > max_retries:
                    raise ShopifyError(f"Shopify request timed out: {e}") from e
                log.warning("Shopify timeout on %s (attempt %d); retrying", url, attempt)
                time.sleep(backoff)
                backoff = min(backoff * 2, 16)
                continue
            except httpx.HTTPError as e:
                raise ShopifyError(f"Shopify transport error: {e}") from e

            if resp.status_code == 429:
                if attempt > max_retries:
                    raise ShopifyRateLimitError()
                retry_after = float(resp.headers.get("Retry-After", backoff))
                log.warning(
                    "Shopify 429 on %s (attempt %d); sleeping %.1fs",
                    url,
                    attempt,
                    retry_after,
                )
                time.sleep(retry_after)
                backoff = min(backoff * 2, 16)
                continue

            if resp.status_code in (500, 502, 503, 504):
                if attempt > max_retries:
                    raise ShopifyError(
                        f"Shopify {resp.status_code} after {attempt} attempts."
                    )
                log.warning(
                    "Shopify %d on %s (attempt %d); backing off %.1fs",
                    resp.status_code,
                    url,
                    attempt,
                    backoff,
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, 16)
                continue

            if resp.status_code in (401, 403):
                raise ShopifyAuthError(
                    "Authentication failed - check SHOPIFY_ACCESS_TOKEN."
                )

            if resp.status_code >= 400:
                # Surface the Shopify error body but never the headers.
                detail = _safe_error_detail(resp)
                raise ShopifyError(f"Shopify {resp.status_code}: {detail}")

            try:
                data = resp.json()
            except ValueError as e:
                raise ShopifyError(f"Malformed JSON from Shopify: {e}") from e

            return ShopifyPage(
                data=data,
                next_page_info=_extract_next_page_info(resp.headers.get("Link", "")),
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )


def _safe_error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return (resp.text or "")[:300]
    if isinstance(body, dict):
        for key in ("errors", "error", "error_description"):
            if key in body:
                return str(body[key])[:500]
    return str(body)[:500]


def _extract_next_page_info(link_header: str) -> Optional[str]:
    """Pull page_info out of a Shopify `Link: rel=next` header."""
    if not link_header:
        return None
    for match in _LINK_RE.finditer(link_header):
        url, rel = match.group(1), match.group(2)
        if rel == "next":
            qs = parse_qs(urlparse(url).query)
            values = qs.get("page_info")
            if values:
                return values[0]
    return None
