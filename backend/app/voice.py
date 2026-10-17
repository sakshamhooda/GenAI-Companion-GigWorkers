"""Speech-to-text: Sarvam Saaras first, Gemini audio as fallback, stub without keys."""

import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.languages import LANGUAGES
from app.llm import extract_json_multimodal

log = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_MODEL = "saaras:v4"
KEYTERMS = [
    "Zomato",
    "Swiggy",
    "Blinkit",
    "Zepto",
    "Uber",
    "Ola",
    "Rapido",
    "Porter",
    "Urban Company",
    "Amazon Flex",
    "e-Shram",
    "PM-SYM",
]

_SARVAM_TO_SHORT = {str(info["sarvam"]): code for code, info in LANGUAGES.items()}


def _short_code(bcp47: str | None) -> str | None:
    """Map 'hi-IN' (or 'hi') to the short code used across the app."""
    if not bcp47:
        return None
    if bcp47 in _SARVAM_TO_SHORT:
        return _SARVAM_TO_SHORT[bcp47]
    base = bcp47.split("-")[0].lower()
    return base if base in LANGUAGES else None


async def _sarvam(
    audio_bytes: bytes, filename: str, content_type: str, language_hint: str | None
) -> dict[str, Any]:
    """Call Sarvam Saaras. Raises on HTTP or network errors so the caller can fall back."""
    lang = str(LANGUAGES[language_hint]["sarvam"]) if language_hint in LANGUAGES else "unknown"
    data = {"model": SARVAM_MODEL, "language_code": lang, "keyterms": json.dumps(KEYTERMS)}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            SARVAM_STT_URL,
            headers={"api-subscription-key": settings.sarvam_api_key or ""},
            files={"file": (filename, audio_bytes, content_type)},
            data=data,
        )
    res.raise_for_status()
    body = res.json()
    return {
        "transcript": (body.get("transcript") or "").strip(),
        "language_code": _short_code(body.get("language_code")),
        "language_probability": body.get("language_probability"),
        "provider": "sarvam",
    }


def _gemini(audio_bytes: bytes, content_type: str) -> dict[str, Any]:
    """Transcribe with Gemini's native audio input. Raises on failure."""
    prompt = (
        "Transcribe this audio exactly, in the original language and its native script. "
        'Return JSON {"transcript": string, "language_code": BCP-47 code like "hi-IN"}.'
    )
    data = extract_json_multimodal(prompt, audio_bytes, content_type)
    return {
        "transcript": (data.get("transcript") or "").strip(),
        "language_code": _short_code(data.get("language_code")),
        "language_probability": None,
        "provider": "gemini",
    }


async def transcribe(
    audio_bytes: bytes, filename: str, content_type: str, language_hint: str | None
) -> dict[str, Any]:
    """Transcribe a short audio clip.

    Order of attempts: Sarvam (if `SARVAM_API_KEY`), then Gemini (if `GEMINI_API_KEY`),
    then a stub with an empty transcript. Never raises; the `provider` field tells the
    caller which path produced the result.
    """
    if settings.sarvam_api_key:
        try:
            return await _sarvam(audio_bytes, filename, content_type, language_hint)
        except Exception as exc:  # noqa: BLE001
            log.warning("sarvam stt failed, falling back to gemini: %s", exc)
    if settings.gemini_api_key:
        try:
            return _gemini(audio_bytes, content_type)
        except Exception as exc:  # noqa: BLE001
            log.warning("gemini stt failed: %s", exc)
    return {
        "transcript": "",
        "language_code": language_hint,
        "language_probability": None,
        "provider": "stub",
    }
