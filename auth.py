"""auth.py — Authentication utility module.

Single source of truth for all authentication primitives:

    Password layer  (bcrypt via passlib)
    ─────────────────────────────────────
    hash_password(plain)          → hashed string
    verify_password(plain, hashed) → bool

    Token layer  (HS256 JWT via python-jose)
    ────────────────────────────────────────
    create_access_token(data)     → JWT string
    decode_access_token(token)    → payload dict  (raises HTTPException on failure)

Nothing outside this module needs to import passlib or jose directly.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Secret key used to sign JWTs.
# Load from an environment variable in production; the fallback is dev-only.
SECRET_KEY: str = os.environ.get(
    "JWT_SECRET_KEY",
    "change-me-in-production-use-a-long-random-string",
)

# HMAC-SHA-256 — swap to "RS256" if you need asymmetric signing later.
ALGORITHM: str = "HS256"

# Token lifetime.
ACCESS_TOKEN_EXPIRE_HOURS: int = 24

# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

# Hashing and verification via native bcrypt library.
def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of *plain_password*.

    The plain text is never stored; callers should discard it immediately
    after calling this function.

    Args:
        plain_password: The raw password string supplied by the user.

    Returns:
        A bcrypt hash string safe to persist in the database.
    """
    pw_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return ``True`` when *plain_password* matches *hashed_password*.

    Uses constant-time comparison internally via bcrypt.checkpw.

    Args:
        plain_password:  The raw password supplied by the user at login.
        hashed_password: The bcrypt hash retrieved from the database.

    Returns:
        ``True`` if the passwords match, ``False`` otherwise.
    """
    try:
        pw_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def create_access_token(data: dict[str, Any]) -> str:
    """Return a signed JWT access token embedding *data* as claims.

    An ``exp`` (expiration) claim is always appended; any caller-supplied
    ``exp`` value is overwritten.

    Args:
        data: Claims to embed.  A ``sub`` (subject) claim identifying the
              user is expected, e.g. ``{"sub": user.email}``.

    Returns:
        A signed JWT string.
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and verify *token*, returning its payload.

    Raises ``HTTP 401 Unauthorized`` on any failure — expired token, bad
    signature, or missing ``sub`` claim — so callers receive a consistent
    error without needing to handle jose exceptions themselves.

    Args:
        token: A raw JWT string (without the ``Bearer `` prefix).

    Returns:
        The decoded payload dictionary.

    Raises:
        :class:`fastapi.HTTPException`: 401 if the token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise credentials_exception

    if payload.get("sub") is None:
        raise credentials_exception

    return payload

# ---------------------------------------------------------------------------
# FastAPI dependency — guards protected routes
# ---------------------------------------------------------------------------

# Import here to avoid circular imports at module load time.
from database import get_db  # noqa: E402
from models import User  # noqa: E402

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that enforces JWT authentication on a route.

    Extracts the ``Authorization: Bearer <token>`` header, verifies the
    token, resolves the ``sub`` claim (email) to a ``User`` ORM object,
    and returns it.  Raises ``HTTP 401 Unauthorized`` when the header is
    absent, the token is invalid / expired, or the user no longer exists.

    Usage in a route::

        @app.get("/protected")
        def protected(current_user: User = Depends(get_current_user)):
            # current_user.id, current_user.email, etc. are all available
            ...

    Args:
        credentials: Injected by FastAPI from the ``Authorization`` header.
        db:          Database session injected by FastAPI via ``get_db``.

    Returns:
        The authenticated :class:`~models.User` ORM instance.

    Raises:
        :class:`fastapi.HTTPException`: 401 if no token is provided, the
            token fails verification, or the user no longer exists.
    """
    _unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Provide a valid Bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise _unauth

    payload = decode_access_token(credentials.credentials)  # raises 401 on bad token
    email: str = payload["sub"]

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise _unauth

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden. Your account has been suspended."
        )

    return user
