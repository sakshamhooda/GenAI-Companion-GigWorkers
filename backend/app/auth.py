"""PIN hashing, signed session tokens and the current-user dependency."""

import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.models import User

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="auth-token")

# Current scheme: "pbkdf2$<iterations>$<salt>$<hex digest>".
# Legacy scheme (first deploy): "<salt>$<hex digest>" with 100k iterations; still verified.
_ITERATIONS = 600_000
_LEGACY_ITERATIONS = 100_000


def _digest(pin: str, salt: str, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), iterations).hex()


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(16)
    return f"pbkdf2${_ITERATIONS}${salt}${_digest(pin, salt, _ITERATIONS)}"


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Constant-time check of `pin` against a stored hash in either scheme."""
    if not pin_hash:
        return False
    parts = pin_hash.split("$")
    try:
        if len(parts) == 4 and parts[0] == "pbkdf2":
            _, iterations, salt, digest = parts
            candidate = _digest(pin, salt, int(iterations))
        elif len(parts) == 2:
            salt, digest = parts
            candidate = _digest(pin, salt, _LEGACY_ITERATIONS)
        else:
            return False
    except ValueError:
        return False
    return hmac.compare_digest(candidate, digest)


def create_token(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def decode_token(token: str) -> int | None:
    """Return the user id in a valid, unexpired token, else None."""
    try:
        data = _serializer.loads(token, max_age=settings.token_ttl_seconds)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid") if isinstance(data, dict) else None
    return uid if isinstance(uid, int) else None


async def get_current_user(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    uid = decode_token(authorization.split(" ", 1)[1].strip())
    if uid is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = await session.scalar(select(User).where(User.id == uid))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user
