"""In-memory sliding-window rate limiting as FastAPI dependencies.

Keys are the client IP (first `X-Forwarded-For` value, which Railway sets) or an explicit
key such as a phone number or user id. Single-process only; good enough for one replica.
"""

import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status

from app.config import settings

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(key: str, limit: int, window_seconds: int) -> None:
    """Record a hit for `key`; raise 429 if more than `limit` hits in the window."""
    if not settings.rate_limit_enabled:
        return
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please wait and try again.",
                headers={"Retry-After": str(retry)},
            )
        q.append(now)


def reset() -> None:
    """Clear all counters (tests)."""
    with _lock:
        _hits.clear()


def per_ip(name: str, limit: int, window_seconds: int = 60) -> Callable[..., None]:
    """Dependency: `limit` requests per `window_seconds` per client IP for route `name`."""

    def dep(request: Request) -> None:
        check(f"{name}:ip:{client_ip(request)}", limit, window_seconds)

    return dep


def per_user(name: str, limit: int, window_seconds: int = 60) -> Callable[..., None]:
    """Dependency: `limit` requests per window per authenticated user."""
    from app.auth import get_current_user  # local import avoids a cycle

    def dep(user=Depends(get_current_user)) -> None:  # noqa: ANN001
        check(f"{name}:user:{user.id}", limit, window_seconds)

    return dep
