from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import settings

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine | None:
    """Lazily create the async engine. Returns None when no DATABASE_URL is configured."""
    global _engine
    if _engine is None and settings.async_database_url:
        _engine = create_async_engine(settings.async_database_url, pool_pre_ping=True)
    return _engine


async def check_database() -> bool:
    """Return True if a round-trip to the database succeeds."""
    engine = get_engine()
    if engine is None:
        return False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
