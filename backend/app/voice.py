"""Speech in and out.

Speech-to-text: Sarvam Saaras first, Gemini audio as fallback, stub without keys.
Text-to-speech: Sarvam Bulbul for the languages it covers, Gemini TTS otherwise;
raises ``LLMUnavailable`` when neither can answer.
"""

import base64
import io
import json
import logging
import re
import wave
from typing import Any

import httpx

from app.config import settings
from app.languages import LANGUAGES
from app.llm import LLMUnavailable, _get_client, extract_json_multimodal

log = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_MODEL = "saaras:v4"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
SARVAM_TTS_MODEL = "bulbul:v4-flash"
SARVAM_TTS_SPEAKER = "shubh_enhi_ads"
SARVAM_TTS_MAX_CHARS = 2500
GEMINI_TTS_MODEL = "gemini-3.8-flash-tts"
GEMINI_TTS_VOICE = "Kore"
_GEMINI_PCM_RATE = 24_000
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


# --- text-to-speech -------------------------------------------------------------------

_MARKDOWN_CHARS = re.compile(r"[*#`_>]+")
_SENTENCE_END = re.compile(r"[.!?।\n]")


def clean_for_speech(text: str) -> str:
    """Strip markdown markers and collapse whitespace so the voice reads plain prose."""
    text = _MARKDOWN_CHARS.sub("", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def truncate_for_speech(text: str, limit: int = SARVAM_TTS_MAX_CHARS) -> str:
    """Cut `text` to `limit` characters at the last sentence boundary before the limit."""
    if len(text) <= limit:
        return text
    head = text[:limit]
    ends = [m.end() for m in _SENTENCE_END.finditer(head)]
    cut = ends[-1] if ends else limit
    return head[:cut].rstrip()


def sarvam_tts_supported(language: str) -> bool:
    return bool(LANGUAGES.get(language, {}).get("tts"))


async def _sarvam_tts(text: str, language: str) -> bytes:
    """Call Sarvam Bulbul. Returns MP3 bytes. Raises on HTTP/network errors."""
    payload = {
        "text": text,
        "language_code": str(LANGUAGES[language]["sarvam"]),
        "model": SARVAM_TTS_MODEL,
        "speaker": SARVAM_TTS_SPEAKER,
        "output_audio_codec": "mp3",
        "speech_sample_rate": 22050,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            SARVAM_TTS_URL,
            headers={"api-subscription-key": settings.sarvam_api_key or ""},
            json=payload,
        )
    res.raise_for_status()
    audios = res.json().get("audios") or []
    if not audios:
        raise RuntimeError("sarvam tts returned no audio")
    return base64.b64decode(audios[0])


def _pcm_to_wav(pcm: bytes, rate: int = _GEMINI_PCM_RATE) -> bytes:
    """Wrap raw 16-bit mono PCM in a WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm)
    return buf.getvalue()


def _gemini_tts(text: str) -> bytes:
    """Synthesize with Gemini TTS. Returns WAV bytes. Raises on failure."""
    client = _get_client()
    if client is None:
        raise LLMUnavailable("gemini not configured")
    from google.genai import types

    res = client.models.generate_content(
        model=GEMINI_TTS_MODEL,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=GEMINI_TTS_VOICE)
                )
            ),
        ),
    )
    for cand in res.candidates or []:
        for part in (cand.content.parts if cand.content else None) or []:
            data = getattr(part, "inline_data", None)
            if data and data.data:
                return _pcm_to_wav(data.data)
    raise RuntimeError("gemini tts returned no audio")


async def synthesize(text: str, language: str) -> tuple[bytes, str, str]:
    """Return (audio bytes, mime type, provider) for `text` spoken in `language`.

    Sarvam Bulbul is used when it covers the language and a key is set; otherwise, or on
    any Sarvam error, Gemini TTS. Raises ``LLMUnavailable`` when no provider can answer.
    """
    spoken = truncate_for_speech(clean_for_speech(text))
    if not spoken:
        raise ValueError("nothing to say")
    if settings.sarvam_api_key and sarvam_tts_supported(language):
        try:
            return await _sarvam_tts(spoken, language), "audio/mpeg", "sarvam"
        except Exception as exc:  # noqa: BLE001
            log.warning("sarvam tts failed, falling back to gemini: %s", exc)
    try:
        return _gemini_tts(spoken), "audio/wav", "gemini"
    except LLMUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        log.warning("gemini tts failed: %s", exc)
        raise LLMUnavailable("tts unavailable") from exc
