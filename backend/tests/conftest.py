"""Test fixtures: every test runs offline against a migrated SQLite database.

The real Postgres is never touched. `alembic upgrade head` runs once per session on a
temp file so the migrations themselves are exercised in CI.
"""

import os
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app import db, llm
from app.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _offline_settings() -> None:
    settings.gemini_api_key = None
    settings.sarvam_api_key = None
    settings.environment = "test"
    if hasattr(settings, "rate_limit_enabled"):
        settings.rate_limit_enabled = False
    llm._client = None


@pytest.fixture(scope="session", autouse=True)
def sqlite_database(tmp_path_factory: pytest.TempPathFactory) -> str:
    """Migrate a fresh SQLite file and point the app's engine at it for the whole session."""
    _offline_settings()
    path = tmp_path_factory.mktemp("db") / "test.sqlite"
    url = f"sqlite:///{path}"
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.cmd_opts = type("Opts", (), {"x": [f"url={url}"]})()
    cwd = os.getcwd()
    os.chdir(BACKEND_DIR)
    try:
        command.upgrade(cfg, "head")
    finally:
        os.chdir(cwd)
    settings.database_url = url
    db.use_engine(create_async_engine(db.to_async_url(url)))
    return url


@pytest.fixture(autouse=True)
def offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-assert stub mode for every test (a test may flip a key on purpose)."""
    _offline_settings()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


@pytest.fixture
def phone_counter() -> list[int]:
    return [0]


@pytest.fixture
async def worker(client: AsyncClient) -> dict:
    """A freshly registered worker: returns {token, user, headers, phone}."""
    import secrets

    phone = "7" + "".join(str(secrets.randbelow(10)) for _ in range(9))
    res = await client.post(
        "/auth/register",
        json={
            "phone": phone,
            "pin": "4321",
            "name": "Test Worker",
            "language": "hi",
            "platforms": ["Zomato", "Swiggy"],
            "work_types": ["delivery"],
            "city": "Jaipur",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    return {
        "token": body["token"],
        "user": body["user"],
        "headers": {"Authorization": f"Bearer {body['token']}"},
        "phone": phone,
    }
