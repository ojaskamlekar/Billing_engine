"""
redis_client.py
---------------
Optional Redis caching layer for the SaaS Storage Billing platform.

If Redis is unavailable (not installed, not running, or misconfigured),
all cache operations silently no-op so the application continues normally.

Environment variables (all optional):
    REDIS_HOST  – default "localhost"
    REDIS_PORT  – default 6379
    REDIS_DB    – default 0
    REDIS_PASSWORD – default None
"""

import json
import logging
import os
from typing import Any, Optional, Callable
import inspect
from functools import wraps

logger = logging.getLogger(__name__)

# ── Try to import redis ──────────────────────────────────────────────────────
try:
    import redis as redis_lib  # type: ignore
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False
    logger.info("redis package not installed – caching disabled.")

# ── Build client (lazy, connection-pooled) ───────────────────────────────────
_client: Optional[Any] = None


def _get_client() -> Optional[Any]:
    """Return a shared Redis client, or None if Redis is unavailable."""
    global _client

    if not _REDIS_AVAILABLE:
        return None

    if _client is not None:
        return _client

    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "0"))
    password = os.getenv("REDIS_PASSWORD") or None

    try:
        pool = redis_lib.ConnectionPool(
            host=host,
            port=port,
            db=db,
            password=password,
            decode_responses=True,
            socket_connect_timeout=1,   # fail fast if Redis is down
            socket_timeout=1,
        )
        _client = redis_lib.Redis(connection_pool=pool)
        # Verify connectivity
        _client.ping()
        logger.info("Redis connected at %s:%s (db=%s)", host, port, db)
    except Exception as exc:  # pragma: no cover
        logger.warning("Redis unavailable (%s) – caching disabled.", exc)
        _client = None

    return _client


# ── Public helpers ───────────────────────────────────────────────────────────

def get_cache(key: str) -> Optional[Any]:
    """
    Retrieve a value from Redis cache.

    Returns the deserialized Python object on a hit, or None on a miss /
    any Redis error.
    """
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug("get_cache(%r) error: %s", key, exc)
        return None


def set_cache(key: str, value: Any, ttl: int = 300) -> bool:
    """
    Store a value in Redis cache.

    Parameters
    ----------
    key   : cache key string
    value : any JSON-serialisable Python object
    ttl   : time-to-live in seconds (default 300 = 5 minutes)

    Returns True on success, False if caching is unavailable or fails.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception as exc:
        logger.debug("set_cache(%r) error: %s", key, exc)
        return False


def delete_cache(key: str) -> bool:
    """
    Delete a key from Redis cache.

    Returns True if the key was deleted, False otherwise.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        result = client.delete(key)
        return result > 0
    except Exception as exc:
        logger.debug("delete_cache(%r) error: %s", key, exc)
        return False


def flush_prefix(prefix: str) -> int:
    """
    Delete all keys that start with *prefix*.

    Useful for invalidating a group of related cache entries (e.g., all
    keys for a specific user).  Returns the number of keys deleted.
    """
    client = _get_client()
    if client is None:
        return 0
    try:
        keys = client.keys(f"{prefix}*")
        if not keys:
            return 0
        return client.delete(*keys)
    except Exception as exc:
        logger.debug("flush_prefix(%r) error: %s", prefix, exc)
        return 0


def is_redis_available() -> bool:
    """Return True if Redis is reachable, False otherwise."""
    client = _get_client()
    if client is None:
        return False
    try:
        return client.ping()
    except Exception:
        return False


def get_redis_stats() -> dict:
    """
    Retrieve live Redis stats: hits, misses, dbsize (keys), memory, and uptime.
    Returns a dictionary of stats, or indicates offline status.
    """
    client = _get_client()
    if client is None:
        return {
            "status": "Offline",
            "hits": 0,
            "misses": 0,
            "keys": 0,
            "memory": "0 B",
            "uptime": "0s"
        }
    try:
        info = client.info()
        dbsize = client.dbsize()
        
        # Format Uptime
        uptime_seconds = info.get("uptime_in_seconds", 0)
        days = uptime_seconds // 86400
        hours = (uptime_seconds % 86400) // 3600
        minutes = (uptime_seconds % 3600) // 60
        seconds = uptime_seconds % 60
        
        uptime_str = []
        if days > 0:
            uptime_str.append(f"{days}d")
        if hours > 0:
            uptime_str.append(f"{hours}h")
        if minutes > 0:
            uptime_str.append(f"{minutes}m")
        uptime_str.append(f"{seconds}s")
        uptime_display = " ".join(uptime_str)
        
        return {
            "status": "Online",
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "keys": dbsize,
            "memory": info.get("used_memory_human", "0 B"),
            "uptime": uptime_display
        }
    except Exception as exc:
        logger.debug("get_redis_stats() error: %s", exc)
        return {
            "status": "Offline",
            "hits": 0,
            "misses": 0,
            "keys": 0,
            "memory": "0 B",
            "uptime": "0s"
        }


def cache_response(ttl: int = 300):
    """
    Decorator to cache responses of FastAPI synchronous/asynchronous endpoints.
    Generates a cache key based on the endpoint name and authenticated user ID.
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        name_map = {
            "get_summary": "summary",
            "forecast": "forecast",
            "recommend_tier": "recommend",
            "get_analytics": "analytics",
            "get_invoice": "invoice"
        }
        endpoint_name = name_map.get(func.__name__, func.__name__)

        if inspect.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                user = kwargs.get("current_user")
                if not user:
                    for arg in args:
                        if arg.__class__.__name__ == "User":
                            user = arg
                            break
                    if not user:
                        for val in kwargs.values():
                            if val.__class__.__name__ == "User":
                                user = val
                                break

                if user:
                    cache_key = f"{endpoint_name}:{user.id}"
                else:
                    cache_key = f"{endpoint_name}:general"

                cached = get_cache(cache_key)
                if cached is not None:
                    cached["from_cache"] = True
                    return cached

                result = await func(*args, **kwargs)
                if result is not None:
                    response_data = result.copy() if isinstance(result, dict) else result
                    if isinstance(response_data, dict):
                        response_data["from_cache"] = False
                    
                    cache_data = result.copy() if isinstance(result, dict) else result
                    if isinstance(cache_data, dict):
                        cache_data["from_cache"] = True
                    
                    set_cache(cache_key, cache_data, ttl=ttl)
                    return response_data
                return result
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                user = kwargs.get("current_user")
                if not user:
                    for arg in args:
                        if arg.__class__.__name__ == "User":
                            user = arg
                            break
                    if not user:
                        for val in kwargs.values():
                            if val.__class__.__name__ == "User":
                                user = val
                                break

                if user:
                    cache_key = f"{endpoint_name}:{user.id}"
                else:
                    cache_key = f"{endpoint_name}:general"

                cached = get_cache(cache_key)
                if cached is not None:
                    cached["from_cache"] = True
                    return cached

                result = func(*args, **kwargs)
                if result is not None:
                    response_data = result.copy() if isinstance(result, dict) else result
                    if isinstance(response_data, dict):
                        response_data["from_cache"] = False
                    
                    cache_data = result.copy() if isinstance(result, dict) else result
                    if isinstance(cache_data, dict):
                        cache_data["from_cache"] = True
                    
                    set_cache(cache_key, cache_data, ttl=ttl)
                    return response_data
                return result
            return sync_wrapper
    return decorator


