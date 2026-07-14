import time
import logging
from fastapi import Request

logger = logging.getLogger("rate_limiter")

class RateLimitException(Exception):
    def __init__(self, detail: str, retry_after: int):
        self.detail = detail
        self.retry_after = retry_after

def check_rate_limit(
    key: str,
    limit: int,
    period: int,
    request: Request,
    endpoint: str,
    user_email: str = None,
    custom_message: str = None
):
    """
    Enforces a rate limit in Redis.
    Raises RateLimitException if rate limit is exceeded.
    """
    import redis_client
    client = redis_client._get_client()
    if not client:
        # Fail open if Redis is down, but log warning
        logger.warning(f"Redis offline – rate limit check bypassed for key: {key}")
        return

    ip = request.client.host if request.client else "unknown"

    try:
        # Check current window count
        current = client.get(key)
        if current is not None:
            current_val = int(current)
            if current_val >= limit:
                ttl = client.ttl(key)
                if ttl < 0:
                    ttl = period
                retry_after = max(1, ttl)

                # Logging blocked request
                logger.warning(
                    f"BLOCKED_REQUEST: timestamp={time.time()}, ip={ip}, endpoint={endpoint}, "
                    f"user={user_email or 'unauthenticated'}, reason=Rate limit exceeded ({current_val}/{limit} in {period}s)"
                )

                # Increment Redis-based stats
                client.incr("rate:stats:blocked_requests")
                today_str = time.strftime("%Y-%m-%d")
                client.incr(f"rate:stats:blocked_today:{today_str}")
                client.expire(f"rate:stats:blocked_today:{today_str}", 86400 * 7) # keep for 7 days

                client.hincrby("rate:stats:endpoints", endpoint, 1)
                client.zincrby("rate:stats:blocked_ips", 1, ip)

                # Format error details
                detail = custom_message or f"Too many requests. Please wait {retry_after} seconds."
                if "{retry_after}" in detail:
                    detail = detail.format(retry_after=retry_after)

                raise RateLimitException(detail=detail, retry_after=retry_after)

        # Atomic increment & expire pipeline
        pipe = client.pipeline()
        pipe.incr(key)
        if current is None:
            pipe.expire(key, period)
        pipe.execute()

    except RateLimitException:
        raise
    except Exception as exc:
        logger.error(f"Rate limiting check failed: {exc}")
