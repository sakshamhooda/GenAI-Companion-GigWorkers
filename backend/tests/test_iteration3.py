"""Analytics, connectors, problems and Google demo mode (offline, SQLite, LLM stubbed)."""

from datetime import date, timedelta

from httpx import AsyncClient

from app import ratelimit
from app.config import settings
from app.connectors import DEMO_PLATFORM
from app.routers.problems import load_kb


async def test_analytics_math_two_platforms(client: AsyncClient, worker: dict) -> None:
    h = worker["headers"]
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    for body in (
        {"amount": 800, "expenses": 100, "platform": "Zomato", "date": today, "hours": 5},
        {"amount": 600, "expenses": 100, "platform": "Swiggy", "date": yesterday, "hours": 2},
        {"amount": 100, "expenses": 0, "platform": "Swiggy", "date": yesterday},
    ):
        assert (await client.post("/earnings", json=body, headers=h)).status_code == 201

    res = await client.get("/earnings/analytics?days=7", headers=h)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["days"] == 7
    assert body["totals"] == {
        "amount": 1500,
        "expenses": 200,
        "net": 1300,
        "hours": 7,
        "net_per_hour": round(1300 / 7, 1),
    }
    by_platform = {p["platform"]: p for p in body["by_platform"]}
    assert by_platform["Zomato"]["net_per_hour"] == 140
    assert by_platform["Swiggy"]["net"] == 600 and by_platform["Swiggy"]["hours"] == 2
    assert by_platform["Swiggy"]["net_per_hour"] == 300
    assert by_platform["Swiggy"]["entries"] == 2
    assert body["best_platform"] == "Swiggy"  # best by net per hour, not by net
    assert len(body["by_day"]) == 7  # zero-filled
    assert body["by_day"][-1] == {"date": today, "net": 700, "hours": 5}
    assert body["by_day"][0]["net"] == 0
    assert body["insight"].startswith("[stub]")


async def test_analytics_empty_has_no_insight(client: AsyncClient, worker: dict) -> None:
    res = await client.get("/earnings/analytics?days=30", headers=worker["headers"])
    assert res.status_code == 200
    body = res.json()
    assert body["by_platform"] == [] and body["best_platform"] is None
    assert body["insight"] == "" and len(body["by_day"]) == 30


async def test_hours_validation_and_parse_stub(client: AsyncClient, worker: dict) -> None:
    h = worker["headers"]
    assert (
        await client.post("/earnings", json={"amount": 1, "hours": 25}, headers=h)
    ).status_code == 422
    res = await client.post("/earnings/parse", json={"text": "4 ghante, 500"}, headers=h)
    assert res.status_code == 200
    assert "hours" in res.json() and res.json()["hours"] is None  # stub does not guess hours


async def test_connectors_list_connect_sync_idempotent_disconnect(
    client: AsyncClient, worker: dict
) -> None:
    h = worker["headers"]
    res = await client.get("/connectors", headers=h)
    assert res.status_code == 200
    items = {c["id"]: c for c in res.json()}
    assert items["screenshot"]["kind"] == "available"
    assert items["demo"]["kind"] == "demo" and items["demo"]["status"] == "none"
    assert items["swiggy"]["kind"] == "coming_soon"

    res = await client.post("/connectors/demo/connect", headers=h)
    assert res.status_code == 200 and res.json() == {"status": "connected", "synced": 5}
    res = await client.post("/connectors/demo/connect", headers=h)
    assert res.json() == {"status": "connected", "synced": 0}  # idempotent
    entries = (await client.get("/earnings?days=30", headers=h)).json()["entries"]
    assert sum(e["platform"] == DEMO_PLATFORM for e in entries) == 5

    res = await client.post("/connectors/swiggy/connect", headers=h)
    assert res.json() == {"status": "interested", "synced": 0}
    assert (await client.post("/connectors/screenshot/connect", headers=h)).status_code == 400
    assert (await client.post("/connectors/nope/connect", headers=h)).status_code == 404

    statuses = {c["id"]: c["status"] for c in (await client.get("/connectors", headers=h)).json()}
    assert statuses["demo"] == "connected" and statuses["swiggy"] == "interested"

    assert (await client.delete("/connectors/demo", headers=h)).status_code == 204
    entries = (await client.get("/earnings?days=30", headers=h)).json()["entries"]
    assert not any(e["platform"] == DEMO_PLATFORM for e in entries)
    statuses = {c["id"]: c["status"] for c in (await client.get("/connectors", headers=h)).json()}
    assert statuses["demo"] == "none"


async def test_screenshot_import_rejects_text_and_stubs_images(
    client: AsyncClient, worker: dict
) -> None:
    h = worker["headers"]
    res = await client.post(
        "/connectors/screenshot/import",
        files={"file": ("x.txt", b"not an image", "text/plain")},
        headers=h,
    )
    assert res.status_code == 415
    res = await client.post(
        "/connectors/screenshot/import",
        files={"file": ("shot.png", b"\x89PNG fake", "image/png")},
        headers=h,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["platform"] and body["entries"][0]["amount"] == 850


def test_legal_kb_is_well_formed() -> None:
    kb = load_kb()
    assert len(kb) >= 14
    ids = [e["id"] for e in kb]
    assert len(ids) == len(set(ids))
    for e in kb:
        assert e["title"] and e["summary"] and e["how_to_use"] and e["applies_to"], e["id"]
    assert "nalsa_legal_aid" in ids


async def test_problem_analyze_stores_row_and_filters_rights(
    client: AsyncClient, worker: dict
) -> None:
    h = worker["headers"]
    res = await client.post(
        "/problems/analyze",
        json={"text": "Zomato ne 400 rupaye kaat liye bina bataye"},
        headers=h,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["category"] == "payout_deduction"
    assert [r["kb_id"] for r in body["rights"]] == [
        "platform_grievance_ladder"
    ]  # invented id dropped
    assert body["options"][0]["title"]
    assert any(c["number"] == "15100" for c in body["contacts"])
    assert body["disclaimer"]

    res = await client.get("/problems", headers=h)
    assert res.status_code == 200
    assert [p["id"] for p in res.json()] == [body["id"]]
    assert res.json()[0]["text"].startswith("Zomato")

    # The chat context picks up the recent issue (stubbed reply, but no error).
    res = await client.post("/chat", json={"message": "ab kya karun?"}, headers=h)
    assert res.status_code == 200


async def test_problem_text_limit(client: AsyncClient, worker: dict) -> None:
    res = await client.post(
        "/problems/analyze", json={"text": "x" * 4001}, headers=worker["headers"]
    )
    assert res.status_code == 422


async def test_google_demo_mode_signs_in_seeded_user(client: AsyncClient) -> None:
    settings.google_client_id = None
    settings.google_demo_mode = True
    ratelimit.reset()
    try:
        cfg = (await client.get("/auth/google/config")).json()
        assert cfg == {"enabled": False, "demo": True}
        res = await client.post("/auth/google", json={"credential": "demo"})
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["token"] and body["user"]["email"] == "demo.google@saathi.app"
        assert body["user"]["platforms"] == ["Uber"] and body["user"]["phone"] is None
        first_new = body["is_new"]
        again = (await client.post("/auth/google", json={"credential": "demo"})).json()
        assert again["user"]["id"] == body["user"]["id"] and again["is_new"] is False
        assert first_new in (True, False)
        me = await client.get("/me", headers={"Authorization": f"Bearer {body['token']}"})
        assert me.status_code == 200
    finally:
        settings.google_demo_mode = False


async def test_google_demo_mode_off_returns_503(client: AsyncClient) -> None:
    settings.google_client_id = None
    settings.google_demo_mode = False
    ratelimit.reset()
    cfg = (await client.get("/auth/google/config")).json()
    assert cfg == {"enabled": False, "demo": False}
    res = await client.post("/auth/google", json={"credential": "demo"})
    assert res.status_code == 503
