"""Lightweight in-memory rate limiter.

Per-process sliding window keyed by client IP + scope. Adequate for a single
Render instance; swap for a Redis-backed limiter if you scale horizontally.
"""
import time
from collections import defaultdict, deque
from fastapi import Request, HTTPException, status

_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(max_requests: int, window_seconds: int, scope: str):
    """FastAPI dependency factory: allow at most `max_requests` per `window_seconds` per IP."""
    def dependency(request: Request):
        ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{ip}"
        now = time.time()
        cutoff = now - window_seconds
        bucket = _hits[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a moment and try again.",
            )
        bucket.append(now)
    return dependency
