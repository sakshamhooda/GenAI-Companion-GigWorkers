import random

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app import llm
from app.config import settings
from app.db import get_sessionmaker
from app.languages import LANGUAGES, reply_instruction
from app.main import app
from app.models import User
from app.util import join_csv, split_csv

needs_db = pytest.mark.skipif(settings.database_url is None, reason="DATABASE_URL not set")


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_csv_helpers() -> None:
    assert split_csv("Zomato, Swiggy,,") == ["Zomato", "Swiggy"]
    assert split_csv(None) == []
    assert join_csv(["Uber", " Uber", "Ola", ""]) == "Uber,Ola"


def test_reply_instruction_names_native_language() -> None:
    assert "தமிழ்" in reply_instruction("ta")
    assert "Indian English" in reply_instruction("en")
    assert len(LANGUAGES) == 13


async def test_earnings_parse_stub_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", None)
    monkeypatch.setattr(llm, "_client", None)
    data = llm.extract_json("aaj 850 kamaye", stub={"amount": 0})
    assert data == {"amount": 0}
    assert llm.generate("hi") == llm.STUB_TEXT


async def test_languages_endpoint() -> None:
    async with _client() as client:
        res = await client.get("/languages")
    assert res.status_code == 200
    codes = {item["code"] for item in res.json()}
    assert {"hi", "en", "ta", "od", "ur"} <= codes


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
                    json={"phone": phone, "pin": "4321", "name": "Test", "language": "xx"},
                )
                assert res.status_code == 422

                res = await client.post(
                    "/auth/register",
                    json={
                        "phone": phone,
                        "pin": "4321",
                        "name": "Test",
                        "language": "ta",
                        "platforms": ["Uber", "Rapido"],
                        "work_types": ["driver", "delivery"],
                        "platform": "Ola",  # legacy singular, folded in
                    },
                )
                assert res.status_code == 201, res.text
                user = res.json()["user"]
                assert user["platforms"] == ["Uber", "Rapido", "Ola"]
                assert user["work_types"] == ["driver", "delivery"]
                assert "platform" not in user and "work_type" not in user
                token = res.json()["token"]
                headers = {"Authorization": f"Bearer {token}"}

                res = await client.post("/auth/login", json={"phone": phone, "pin": "0000"})
                assert res.status_code == 401
                res = await client.post("/auth/login", json={"phone": phone, "pin": "4321"})
                assert res.status_code == 200

                res = await client.put("/me", json={"platforms": ["Rapido"]}, headers=headers)
                assert res.status_code == 200 and res.json()["platforms"] == ["Rapido"]

                res = await client.post(
                    "/earnings", json={"amount": 500, "expenses": 50}, headers=headers
                )
                assert res.status_code == 201 and res.json()["platform"] == "Rapido"
                res = await client.get("/earnings?days=7", headers=headers)
                body = res.json()
                assert body["total_amount"] == 500 and body["net"] == 450

                res = await client.post("/earnings/parse", json={"text": "700"}, headers=headers)
                assert res.status_code == 200 and res.json()["platform"] == "Rapido"

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
