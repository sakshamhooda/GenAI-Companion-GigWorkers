from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_root() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_health_reports_database_flag() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert isinstance(body["database"], bool)
