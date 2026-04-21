"""Logging setup."""

from __future__ import annotations

import logging
import sys


_CONFIGURED = False


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging exactly once."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    root = logging.getLogger()
    root.setLevel(level.upper())

    # Remove default handlers so we don't get duplicate lines under uvicorn.
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    root.addHandler(handler)

    # Quiet chatty libs unless user explicitly enabled DEBUG.
    if level.upper() != "DEBUG":
        for noisy in ("httpx", "httpcore", "urllib3", "google", "grpc"):
            logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
