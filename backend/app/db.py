"""Async database access. Schema changes live in `alembic/`, never here."""

from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


class Base(DeclarativeBase):
    """Declarative base shared by the models and the Alembic environment."""


def to_async_url(url: str) -> str:
    """Map a plain DB URL onto its async driver (postgresql → asyncpg); sqlite URLs pass through."""
    if url.startswith("sqlite"):
        return url if "+aiosqlite" in url else url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url.replace("postgresql://", "postgresql+asyncpg://", 1)


def get_engine() -> AsyncEngine | None:
    """Lazily create the async engine. Returns None when no DATABASE_URL is configured."""
    global _engine
    if _engine is None and settings.database_url:
        url = to_async_url(settings.database_url)
        # SQLite (tests) has no pool options; Postgres gets a bounded, recycled pool.
        pool_kwargs = (
            {}
            if url.startswith("sqlite")
            else {"pool_size": 5, "max_overflow": 10, "pool_recycle": 1800, "pool_timeout": 10}
        )
        _engine = create_async_engine(url, pool_pre_ping=True, **pool_kwargs)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Session factory bound to the lazily created engine."""
    global _sessionmaker
    if _sessionmaker is None:
        engine = get_engine()
        if engine is None:
            raise RuntimeError("DATABASE_URL is not configured")
        _sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
    return _sessionmaker


def use_engine(engine: AsyncEngine | None) -> None:
    """Swap the process-wide engine (tests point this at SQLite)."""
    global _engine, _sessionmaker
    _engine = engine
    _sessionmaker = None if engine is None else async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with get_sessionmaker()() as session:
        yield session


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
