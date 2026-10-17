import random

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app import llm
from app.config import settings
from app.db import get_sessionmaker
from app.main import app
from app.models import User

needs_db = pytest.mark.skipif(settings.database_url is None, reason="DATABASE_URL not set")


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_earnings_parse_stub_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(llm, "_client", None)
    data = llm.extract_json("aaj 850 kamaye", stub={"amount": 0})
    assert data == {"amount": 0}
    assert llm.generate("hi") == llm.STUB_TEXT


@needs_db
async def test_register_login_earnings_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(llm, "_client", None)
    phone = "8" + "".join(random.choices("0123456789", k=9))
    async with app.router.lifespan_context(app):
        try:
            async with _client() as client:
                res = await client.post(
                    "/auth/register",
                    json={"phone": phone, "pin": "4321", "name": "Test", "platform": "Swiggy"},
                )
                assert res.status_code == 201, res.text
                token = res.json()["token"]
                headers = {"Authorization": f"Bearer {token}"}

                res = await client.post("/auth/login", json={"phone": phone, "pin": "0000"})
                assert res.status_code == 401
                res = await client.post("/auth/login", json={"phone": phone, "pin": "4321"})
                assert res.status_code == 200

                res = await client.post(
                    "/earnings", json={"amount": 500, "expenses": 50}, headers=headers
                )
                assert res.status_code == 201
                res = await client.get("/earnings?days=7", headers=headers)
                body = res.json()
                assert body["total_amount"] == 500 and body["net"] == 450

                res = await client.post("/chat", json={"message": "hello"}, headers=headers)
                assert res.status_code == 200 and res.json()["reply"] == llm.STUB_TEXT
                res = await client.get("/chat/history", headers=headers)
                assert len(res.json()) == 2

                res = await client.post(
                    "/grievances/draft",
                    json={"kind": "deduction", "description": "50 cut"},
                    headers=headers,
                )
                assert res.status_code == 201 and "[stub]" in res.json()["draft_local"]
        finally:
            async with get_sessionmaker()() as session:
                await session.execute(delete(User).where(User.phone == phone))
                await session.commit()
