"""Earnings, chat and grievance flows against the SQLite test database (LLM stubbed)."""

from datetime import date, timedelta

from httpx import AsyncClient

from app import llm


async def test_earnings_create_list_and_summary_math(client: AsyncClient, worker: dict) -> None:
    h = worker["headers"]
    today = date.today().isoformat()
    old = (date.today() - timedelta(days=30)).isoformat()

    res = await client.post("/earnings", json={"amount": 500, "expenses": 50}, headers=h)
    assert res.status_code == 201, res.text
    assert res.json()["platform"] == "Zomato"  # defaults to the worker's first platform

    res = await client.post(
        "/earnings",
        json={"amount": 300, "expenses": 0, "platform": "Swiggy", "date": today, "note": "x"},
        headers=h,
    )
    assert res.status_code == 201
    res = await client.post(
        "/earnings", json={"amount": 999, "expenses": 1, "date": old}, headers=h
    )
    assert res.status_code == 201

    res = await client.get("/earnings?days=7", headers=h)
    assert res.status_code == 200
    body = res.json()
    assert len(body["entries"]) == 2  # the 30-day-old entry is outside the window
    assert body["total_amount"] == 800
    assert body["total_expenses"] == 50
    assert body["net"] == 750

    res = await client.get("/earnings?days=60", headers=h)
    assert len(res.json()["entries"]) == 3


async def test_earnings_requires_auth(client: AsyncClient) -> None:
    assert (await client.get("/earnings")).status_code == 401
    assert (await client.post("/earnings", json={"amount": 1})).status_code == 401


async def test_earnings_parse_stub_uses_worker_platform(client: AsyncClient, worker: dict) -> None:
    res = await client.post("/earnings/parse", json={"text": "700"}, headers=worker["headers"])
    assert res.status_code == 200
    body = res.json()
    assert body["platform"] == "Zomato"
    assert set(body) >= {"amount", "expenses", "platform", "date", "note"}


async def test_chat_stores_both_messages(client: AsyncClient, worker: dict) -> None:
    h = worker["headers"]
    res = await client.get("/chat/history", headers=h)
    assert res.status_code == 200 and res.json() == []

    res = await client.post("/chat", json={"message": "mujhe safety tips do"}, headers=h)
    assert res.status_code == 200
    assert res.json()["reply"] == llm.STUB_TEXT

    res = await client.get("/chat/history", headers=h)
    history = res.json()
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[0]["content"] == "mujhe safety tips do"
    assert history[1]["content"] == llm.STUB_TEXT


async def test_chat_rejects_empty_message(client: AsyncClient, worker: dict) -> None:
    res = await client.post("/chat", json={"message": ""}, headers=worker["headers"])
    assert res.status_code == 422


async def test_grievance_draft_and_list(client: AsyncClient, worker: dict) -> None:
    h = worker["headers"]
    res = await client.post(
        "/grievances/draft",
        json={"kind": "payout_deduction", "description": "Rs 50 cut for a cancelled order"},
        headers=h,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "payout_deduction"
    assert "[stub]" in body["draft_local"]
    assert body["draft_english"]

    res = await client.get("/grievances", headers=h)
    assert res.status_code == 200
    assert [g["id"] for g in res.json()] == [body["id"]]


async def test_data_is_isolated_per_worker(client: AsyncClient, worker: dict) -> None:
    other = await client.post(
        "/auth/register",
        json={"phone": "7222222222", "pin": "1111", "name": "Other", "language": "en"},
    )
    assert other.status_code == 201
    oh = {"Authorization": f"Bearer {other.json()['token']}"}
    await client.post("/earnings", json={"amount": 100}, headers=worker["headers"])
    res = await client.get("/earnings", headers=oh)
    assert res.json()["entries"] == []
