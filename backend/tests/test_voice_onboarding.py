from httpx import AsyncClient


async def test_onboarding_parse_stub(client: AsyncClient) -> None:
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


async def test_onboarding_parse_rejects_empty(client: AsyncClient) -> None:
    res = await client.post("/onboarding/parse", json={"text": ""})
    assert res.status_code == 422


async def test_transcribe_rejects_non_audio(client: AsyncClient) -> None:
    res = await client.post("/voice/transcribe", files={"file": ("note.txt", b"hi", "text/plain")})
    assert res.status_code == 415


async def test_transcribe_rejects_oversized(client: AsyncClient) -> None:
    big = b"\0" * (3 * 1024 * 1024 + 1)
    res = await client.post("/voice/transcribe", files={"file": ("a.webm", big, "audio/webm")})
    assert res.status_code == 413


async def test_transcribe_rejects_empty(client: AsyncClient) -> None:
    res = await client.post("/voice/transcribe", files={"file": ("a.webm", b"", "audio/webm")})
    assert res.status_code == 400


async def test_transcribe_stub_without_keys(client: AsyncClient) -> None:
    res = await client.post(
        "/voice/transcribe",
        files={"file": ("a.webm", b"\0\1\2", "audio/webm")},
        data={"language": "hi"},
    )
    assert res.status_code == 200
    assert res.json()["provider"] == "stub"
