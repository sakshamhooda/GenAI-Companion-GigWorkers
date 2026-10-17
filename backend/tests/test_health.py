from httpx import AsyncClient


async def test_root(client: AsyncClient) -> None:
    res = await client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_health_reports_database_and_llm_flags(client: AsyncClient) -> None:
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] is True  # SQLite test database answers SELECT 1
    assert body["llm"] is False  # stub mode in tests


async def test_languages_endpoint(client: AsyncClient) -> None:
    res = await client.get("/languages")
    assert res.status_code == 200
    codes = {item["code"] for item in res.json()}
    assert {"hi", "en", "ta", "od", "ur"} <= codes
    assert len(codes) == 13
