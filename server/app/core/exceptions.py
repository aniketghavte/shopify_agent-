"""Domain exceptions.

Raw Shopify/Google errors can echo headers/tokens, so we wrap them
in one of these types before they reach the HTTP layer.
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for all application errors."""

    status_code: int = 500
    public_message: str = "Internal server error"


class ShopifyError(AppError):
    status_code = 502
    public_message = "Shopify API error"


class ShopifyRateLimitError(ShopifyError):
    status_code = 429
    public_message = "Shopify rate limit exceeded; please retry shortly"


class ShopifyAuthError(ShopifyError):
    status_code = 401
    public_message = "Shopify authentication failed"


class UnsafeOperationError(AppError):
    """Raised when the agent tries a non-GET or otherwise disallowed call."""

    status_code = 400
    public_message = "This operation is not permitted."


class AgentError(AppError):
    status_code = 500
    public_message = "Agent execution failed"
