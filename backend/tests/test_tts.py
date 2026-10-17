import base64

import pytest
from httpx import AsyncClient

from app import voice
from app.config import settings
from app.languages import LANGUAGES


def test_clean_for_speech_strips_markdown() -> None:
    assert voice.clean_for_speech("**नमस्ते**  `रमेश` # शीर्षक") == "नमस्ते रमेश शीर्षक"


def test_truncate_for_speech_cuts_at_sentence() -> None:
    text = "पहला वाक्य। दूसरा वाक्य। " + "x" * 3000
    out = voice.truncate_for_speech(text, limit=30)
    assert out == "पहला वाक्य। दूसरा वाक्य।"
    assert voice.truncate_for_speech("short", limit=30) == "short"


def test_tts_flags_match_bulbul_v4() -> None:
    expected = {"hi", "en", "bn", "gu", "kn", "mr", "pa", "ta", "te"}
    assert {c for c, i in LANGUAGES.items() if i["tts"]} == expected


async def test_speak_requires_auth(client: AsyncClient) -> None:
    res = await client.post("/voice/speak", json={"text": "hi"})
    assert res.status_code == 401


async def test_speak_unsupported_language_422(client: AsyncClient, worker: dict) -> None:
    res = await client.post(
        "/voice/speak", json={"text": "hi", "language": "xx"}, headers=worker["headers"]
    )
    assert res.status_code == 422


async def test_speak_without_keys_503(client: AsyncClient, worker: dict) -> None:
    res = await client.post("/voice/speak", json={"text": "नमस्ते"}, headers=worker["headers"])
    assert res.status_code == 503
    assert "Retry-After" in res.headers


async def test_speak_sarvam_path(
    client: AsyncClient, worker: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict = {}

    class _Res:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"audios": [base64.b64encode(b"ID3mp3bytes").decode()]}

    class _Client:
        def __init__(self, *a, **k) -> None:  # noqa: ANN002, ANN003
            pass

        async def __aenter__(self) -> "_Client":
            return self

        async def __aexit__(self, *a) -> None:  # noqa: ANN002
            return None

        async def post(self, url: str, headers: dict, json: dict) -> _Res:  # noqa: A002
            captured.update(url=url, json=json)
            return _Res()

    monkeypatch.setattr(voice.httpx, "AsyncClient", _Client)
    settings.sarvam_api_key = "test-key"
    res = await client.post(
        "/voice/speak", json={"text": "**नमस्ते** रमेश"}, headers=worker["headers"]
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("audio/mpeg")
    assert res.headers["x-tts-provider"] == "sarvam"
    assert res.content == b"ID3mp3bytes"
    assert captured["url"] == voice.SARVAM_TTS_URL
    assert captured["json"]["language_code"] == "hi-IN"
    assert captured["json"]["text"] == "नमस्ते रमेश"
    assert captured["json"]["model"] == voice.SARVAM_TTS_MODEL


def test_pcm_to_wav_header() -> None:
    wav = voice._pcm_to_wav(b"\0\0" * 10)
    assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"
