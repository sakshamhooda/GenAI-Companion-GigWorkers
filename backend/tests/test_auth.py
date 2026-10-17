from httpx import AsyncClient

from app.config import settings
from app.seed import seed_demo


async def test_register_rejects_unknown_language(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/register",
        json={"phone": "7111111111", "pin": "4321", "name": "X", "language": "xx"},
    )
    assert res.status_code == 422


async def test_register_rejects_bad_pin(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/register",
        json={"phone": "7111111112", "pin": "12", "name": "X", "language": "hi"},
    )
    assert res.status_code == 422


async def test_register_returns_lists_and_hides_pin(client: AsyncClient, worker: dict) -> None:
    user = worker["user"]
    assert user["platforms"] == ["Zomato", "Swiggy"]
    assert user["work_types"] == ["delivery"]
    assert "pin_hash" not in user
    assert "platform" not in user and "work_type" not in user


async def test_register_folds_legacy_singular_fields(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/register",
        json={
            "phone": "7111111113",
            "pin": "4321",
            "name": "Legacy",
            "language": "ta",
            "platforms": ["Uber"],
            "platform": "Ola",
            "work_type": "driver",
        },
    )
    assert res.status_code == 201, res.text
    user = res.json()["user"]
    assert user["platforms"] == ["Uber", "Ola"]
    assert user["work_types"] == ["driver"]


async def test_register_duplicate_phone_conflicts(client: AsyncClient, worker: dict) -> None:
    res = await client.post(
        "/auth/register",
        json={"phone": worker["phone"], "pin": "4321", "name": "Dup", "language": "hi"},
    )
    assert res.status_code == 409


async def test_login_wrong_pin_and_unknown_phone(client: AsyncClient, worker: dict) -> None:
    res = await client.post("/auth/login", json={"phone": worker["phone"], "pin": "0000"})
    assert res.status_code == 401
    res = await client.post("/auth/login", json={"phone": "7000000001", "pin": "4321"})
    assert res.status_code == 401


async def test_login_success(client: AsyncClient, worker: dict) -> None:
    res = await client.post("/auth/login", json={"phone": worker["phone"], "pin": "4321"})
    assert res.status_code == 200
    assert res.json()["user"]["id"] == worker["user"]["id"]


async def test_demo_user_seeded_only_from_environment(client: AsyncClient, monkeypatch) -> None:
    # Nothing configured: no demo worker exists.
    monkeypatch.setattr(settings, "demo_phone", None)
    monkeypatch.setattr(settings, "demo_pin", None)
    await seed_demo()
    res = await client.post("/auth/login", json={"phone": "9000000001", "pin": "2468"})
    assert res.status_code == 401

    # Configured via settings (environment): seeded idempotently and can log in.
    monkeypatch.setattr(settings, "demo_phone", "9000000001")
    monkeypatch.setattr(settings, "demo_pin", "2468")
    await seed_demo()
    await seed_demo()
    res = await client.post("/auth/login", json={"phone": "9000000001", "pin": "2468"})
    assert res.status_code == 200
    user = res.json()["user"]
    assert user["name"] == "Ramesh"
    assert user["platforms"] == ["Zomato", "Swiggy"]


async def test_me_requires_token(client: AsyncClient) -> None:
    assert (await client.get("/me")).status_code == 401
    bad = {"Authorization": "Bearer not-a-token"}
    assert (await client.get("/me", headers=bad)).status_code == 401


async def test_me_and_update(client: AsyncClient, worker: dict) -> None:
    res = await client.get("/me", headers=worker["headers"])
    assert res.status_code == 200 and res.json()["city"] == "Jaipur"

    res = await client.put(
        "/me",
        json={"platforms": ["Rapido"], "language": "ta", "memory": "Night driver."},
        headers=worker["headers"],
    )
    assert res.status_code == 200
    body = res.json()
    assert body["platforms"] == ["Rapido"]
    assert body["language"] == "ta"
    assert body["memory"] == "Night driver."

    res = await client.put("/me", json={"language": "zz"}, headers=worker["headers"])
    assert res.status_code == 422
