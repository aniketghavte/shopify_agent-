"""LangChain tools for reading Shopify data.

All GET-only. One general-purpose tool plus a few narrow wrappers
for the common endpoints (the wrappers just give the model clearer
signatures to pick from).
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from ..config import Settings
from ..core.exceptions import AppError
from ..core.logging import get_logger
from .shopify_client import ShopifyClient

log = get_logger(__name__)


class GetShopifyDataInput(BaseModel):
    path: str = Field(
        ...,
        description=(
            "Relative Shopify Admin REST path, without `.json` and without a leading "
            "slash. Examples: 'orders', 'orders/count', 'products', 'customers', "
            "'orders/123456789'."
        ),
    )
    params: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Query-string parameters. Common keys: limit (<=250), status "
            "('any'|'open'|'closed'|'cancelled'), created_at_min / created_at_max "
            "(ISO-8601), updated_at_min, financial_status, fulfillment_status, "
            "fields (comma-separated)."
        ),
    )
    paginate: bool = Field(
        default=True,
        description=(
            "If true (default), follow Link: rel=\"next\" pages up to SHOPIFY_MAX_PAGES "
            "and return merged results. If false, fetch only the first page."
        ),
    )


class ListOrdersInput(BaseModel):
    status: str = Field(default="any", description="'any'|'open'|'closed'|'cancelled'")
    created_at_min: Optional[str] = Field(
        default=None, description="ISO-8601 lower bound for order creation time."
    )
    created_at_max: Optional[str] = Field(
        default=None, description="ISO-8601 upper bound for order creation time."
    )
    financial_status: Optional[str] = Field(default=None)
    fulfillment_status: Optional[str] = Field(default=None)
    fields: Optional[str] = Field(
        default=None,
        description="Comma-separated list of fields to return (reduces payload size).",
    )
    limit: int = Field(default=100, ge=1, le=250)
    paginate: bool = Field(default=True)


class ListProductsInput(BaseModel):
    vendor: Optional[str] = Field(default=None)
    product_type: Optional[str] = Field(default=None)
    created_at_min: Optional[str] = Field(default=None)
    updated_at_min: Optional[str] = Field(default=None)
    fields: Optional[str] = Field(default=None)
    limit: int = Field(default=100, ge=1, le=250)
    paginate: bool = Field(default=True)


class ListCustomersInput(BaseModel):
    created_at_min: Optional[str] = Field(default=None)
    updated_at_min: Optional[str] = Field(default=None)
    fields: Optional[str] = Field(default=None)
    limit: int = Field(default=100, ge=1, le=250)
    paginate: bool = Field(default=True)


class CountInput(BaseModel):
    resource: str = Field(
        ..., description="'orders' | 'products' | 'customers'"
    )
    params: Optional[Dict[str, Any]] = Field(default=None)


def build_shopify_tools(settings: Settings) -> Tuple[List[Any], ShopifyClient]:
    """Return a list of LangChain tools bound to a single ShopifyClient.

    The client lives for the lifetime of a single agent run and is
    closed by the caller.
    """
    client = ShopifyClient(settings)

    def _run(path: str, params: Optional[Dict[str, Any]], paginate: bool) -> str:
        try:
            if paginate:
                payload = client.get_all(path, params=params)
            else:
                page = client.get(path, params=params)
                payload = page.data
            return _safe_serialize(payload)
        except AppError as e:
            return json.dumps({"error": e.public_message, "detail": str(e)})
        except Exception as e:  # pragma: no cover
            log.exception("Unexpected error inside Shopify tool")
            return json.dumps({"error": "Tool execution failed", "detail": str(e)})

    @tool("get_shopify_data", args_schema=GetShopifyDataInput)
    def get_shopify_data(
        path: str,
        params: Optional[Dict[str, Any]] = None,
        paginate: bool = True,
    ) -> str:
        """GET against the Shopify Admin REST API (read-only).

        Returns JSON text. Use this for any endpoint the specialized
        tools below don't cover. Only GET is supported.
        """
        return _run(path, params, paginate)

    @tool("list_orders", args_schema=ListOrdersInput)
    def list_orders(
        status: str = "any",
        created_at_min: Optional[str] = None,
        created_at_max: Optional[str] = None,
        financial_status: Optional[str] = None,
        fulfillment_status: Optional[str] = None,
        fields: Optional[str] = None,
        limit: int = 100,
        paginate: bool = True,
    ) -> str:
        """List orders with common filters pre-wired.

        Passing `fields=` like
        'id,created_at,total_price,currency,customer,line_items,shipping_address'
        keeps responses small.
        """
        params: Dict[str, Any] = {"status": status, "limit": limit}
        for k, v in {
            "created_at_min": created_at_min,
            "created_at_max": created_at_max,
            "financial_status": financial_status,
            "fulfillment_status": fulfillment_status,
            "fields": fields,
        }.items():
            if v is not None:
                params[k] = v
        return _run("orders", params, paginate)

    @tool("list_products", args_schema=ListProductsInput)
    def list_products(
        vendor: Optional[str] = None,
        product_type: Optional[str] = None,
        created_at_min: Optional[str] = None,
        updated_at_min: Optional[str] = None,
        fields: Optional[str] = None,
        limit: int = 100,
        paginate: bool = True,
    ) -> str:
        """List products. A compact `fields` value is
        'id,title,vendor,product_type,variants,created_at,status'."""
        params: Dict[str, Any] = {"limit": limit}
        for k, v in {
            "vendor": vendor,
            "product_type": product_type,
            "created_at_min": created_at_min,
            "updated_at_min": updated_at_min,
            "fields": fields,
        }.items():
            if v is not None:
                params[k] = v
        return _run("products", params, paginate)

    @tool("list_customers", args_schema=ListCustomersInput)
    def list_customers(
        created_at_min: Optional[str] = None,
        updated_at_min: Optional[str] = None,
        fields: Optional[str] = None,
        limit: int = 100,
        paginate: bool = True,
    ) -> str:
        """List customers. A compact `fields` value is
        'id,email,first_name,last_name,orders_count,total_spent,default_address'."""
        params: Dict[str, Any] = {"limit": limit}
        for k, v in {
            "created_at_min": created_at_min,
            "updated_at_min": updated_at_min,
            "fields": fields,
        }.items():
            if v is not None:
                params[k] = v
        return _run("customers", params, paginate)

    @tool("count_resource", args_schema=CountInput)
    def count_resource(
        resource: str, params: Optional[Dict[str, Any]] = None
    ) -> str:
        """Return the count for 'orders', 'products', or 'customers'.

        Much cheaper than listing when you only need a total.
        """
        resource = resource.strip().lower()
        if resource not in {"orders", "products", "customers"}:
            return json.dumps({"error": "resource must be orders|products|customers"})
        return _run(f"{resource}/count", params, paginate=False)

    @tool("get_shop_info")
    def get_shop_info() -> str:
        """Return basic metadata about the Shopify shop
        (name, domain, currency, timezone, plan)."""
        return _run("shop", None, paginate=False)

    tools = [
        get_shopify_data,
        list_orders,
        list_products,
        list_customers,
        count_resource,
        get_shop_info,
    ]
    return tools, client


def _safe_serialize(payload: Any, max_chars: int = 120_000) -> str:
    """Serialize to JSON, truncating if huge.

    Returning unbounded JSON to the LLM is bad for both context window
    and cost. 120k chars is roughly 30k tokens.
    """
    try:
        s = json.dumps(payload, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        s = json.dumps({"raw": str(payload)[:max_chars]})
    if len(s) <= max_chars:
        return s
    return json.dumps(
        {
            "truncated": True,
            "note": (
                f"Response truncated to {max_chars} chars. Re-query with 'fields=' "
                "or a tighter date range to reduce size."
            ),
            "preview": s[:max_chars],
        }
    )
