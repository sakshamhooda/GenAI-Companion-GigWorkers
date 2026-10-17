from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_onboarding_parse_stub(monkeypatch) -> None:
    monkeypatch.setattr(settings, "gemini_api_key", None)
    async with _client() as client:
        res = await client.post(
            "/onboarding/parse",
            json={"text": "Main Jaipur mein Zomato ke liye raat ko delivery karta hoon"},
        )
    assert res.status_code == 200
    body = res.json()
    for key in (
        "name",
        "language",
        "work_types",
        "platforms",
        "city",
        "shift",
        "years_experience",
        "memory",
    ):
        assert key in body
    assert isinstance(body["work_types"], list)
    assert isinstance(body["platforms"], list)


async def test_transcribe_rejects_non_audio() -> None:
    async with _client() as client:
        res = await client.post(
            "/voice/transcribe", files={"file": ("note.txt", b"hello", "text/plain")}
        )
    assert res.status_code == 415


async def test_transcribe_rejects_oversized() -> None:
    big = b"\0" * (3 * 1024 * 1024 + 1)
    async with _client() as client:
        res = await client.post("/voice/transcribe", files={"file": ("a.webm", big, "audio/webm")})
    assert res.status_code == 413


async def test_transcribe_stub_without_keys(monkeypatch) -> None:
    monkeypatch.setattr(settings, "sarvam_api_key", None)
    monkeypatch.setattr(settings, "gemini_api_key", None)
    async with _client() as client:
        res = await client.post(
            "/voice/transcribe",
            files={"file": ("a.webm", b"\0\1\2", "audio/webm")},
            data={"language": "hi"},
        )
    assert res.status_code == 200
    assert res.json()["provider"] == "stub"
