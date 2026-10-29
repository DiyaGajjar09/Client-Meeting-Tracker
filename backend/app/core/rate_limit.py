"""In-memory sliding-window rate limiting for security-sensitive API operations.

Protects against brute-force password guessing, Gemini LLM quota exhaustion,
and denial-of-service from concurrent export/upload operations.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request

from app.core.config import settings
from app.core.exceptions import RateLimitExceededError


class SlidingWindowRateLimiter:
    """Thread-safe sliding-window rate limiter per client IP address."""

    def __init__(self):
        # Maps (bucket, client_ip) -> list of access timestamps
        self._records: dict[tuple[str, str], list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, bucket: str, client_ip: str, max_requests: int, window_seconds: int = 60) -> bool:
        """Check if request count within window_seconds is under max_requests."""
        if not settings.RATE_LIMIT_ENABLED:
            return True

        now = time.time()
        key = (bucket, client_ip or "unknown")

        with self._lock:
            timestamps = self._records[key]
            # Prune timestamps older than window
            cutoff = now - window_seconds
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._records[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                return False

            self._records[key].append(now)
            return True

    def clear(self):
        """Reset rate limiter state (useful for tests)."""
        with self._lock:
            self._records.clear()


limiter = SlidingWindowRateLimiter()


def rate_limit(bucket: str, max_requests_func: Callable[[], int] | int):
    """FastAPI dependency to enforce rate limits per operation bucket."""

    async def dependency(request: Request):
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "127.0.0.1")
        )
        limit = max_requests_func() if callable(max_requests_func) else max_requests_func

        if not limiter.is_allowed(bucket=bucket, client_ip=client_ip, max_requests=limit):
            raise RateLimitExceededError(
                f"Rate limit exceeded for '{bucket}'. Maximum {limit} requests per minute allowed."
            )

    return dependency
