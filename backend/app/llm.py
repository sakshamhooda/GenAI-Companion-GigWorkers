"""Thin Gemini client.

Behaviour:
- No API key configured: every call returns deterministic stub output so the app
  and its tests run offline.
- Key configured: calls are retried on transient errors (429/503) with a short
  backoff, then once more on a fallback model. If that also fails the call raises
  ``LLMUnavailable``, which the API maps to HTTP 503. Stub output is never served
  when a key is configured, so a worker never sees placeholder data by mistake.
"""

import asyncio
import json
import logging
import time
from typing import Any

from app.config import settings

log = logging.getLogger(__name__)

STUB_TEXT = "[stub] Saathi is running without an LLM key. This is a placeholder reply."
STUB_JSON: dict[str, Any] = {"stub": True}

FALLBACK_MODEL = "gemini-3.5-flash"
_RETRY_DELAYS = (0.5, 1.5)
_TRANSIENT_MARKERS = ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "overloaded", "timeout")

_client: Any = None


class LLMUnavailable(RuntimeError):
    """Raised when the model cannot answer after retries and the fallback model."""


def _get_client() -> Any:
    """Return a process-wide Gemini client, or None when no key is configured.

    The SDK is imported lazily so the app (and its tests) start without it.
    """
    global _client
    if _client is None and settings.gemini_api_key:
        from google import genai

        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _config(system: str | None, json_mode: bool) -> Any:
    """Build the generation config: no thinking budget (latency), low temperature."""
    from google.genai import types

    return types.GenerateContentConfig(
        system_instruction=system,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        response_mime_type="application/json" if json_mode else None,
        temperature=0.4,
    )


def _is_transient(exc: Exception) -> bool:
    text = str(exc)
    return any(marker in text for marker in _TRANSIENT_MARKERS)


def _generate_with_retry(client: Any, contents: Any, system: str | None, json_mode: bool) -> str:
    """Call the primary model with retries, then the fallback model once."""
    attempts: list[tuple[str, float | None]] = [
        (settings.gemini_model, _RETRY_DELAYS[0]),
        (settings.gemini_model, _RETRY_DELAYS[1]),
        (settings.gemini_model, None),
        (FALLBACK_MODEL, None),
    ]
    last_exc: Exception | None = None
    for model, delay in attempts:
        try:
            res = client.models.generate_content(
                model=model, contents=contents, config=_config(system, json_mode)
            )
            return (res.text or "").strip()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            log.warning("gemini call failed (model=%s): %s", model, exc)
            if not _is_transient(exc):
                break
            if delay:
                time.sleep(delay)
    raise LLMUnavailable("model unavailable") from last_exc


def generate(prompt: str, system: str | None = None) -> str:
    """Return plain text from the model. Raises ``LLMUnavailable`` when the model is down."""
    client = _get_client()
    if client is None:
        return STUB_TEXT
    text = _generate_with_retry(client, prompt, system, json_mode=False)
    return text or "Sorry, I could not generate a reply. Please try again."


def _parse_json(text: str | None) -> dict:
    """Parse model output as a JSON object, tolerating ```json fences."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    try:
        data = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


def extract_json(prompt: str, system: str | None = None, stub: dict | None = None) -> dict:
    """Ask the model for a JSON object and parse it.

    Without a key returns ``stub`` (or a marker dict). With a key, raises
    ``LLMUnavailable`` if the model is down; returns ``{}`` if the output is not JSON.
    """
    client = _get_client()
    if client is None:
        return dict(stub) if stub is not None else dict(STUB_JSON)
    return _parse_json(_generate_with_retry(client, prompt, system, json_mode=True))


def extract_json_multimodal(
    prompt: str, data: bytes, mime_type: str, system: str | None = None
) -> dict:
    """Same as ``extract_json`` but with an inline audio/image part. Raises on failure."""
    client = _get_client()
    if client is None:
        raise RuntimeError("gemini not configured")
    from google.genai import types

    contents = [types.Part.from_bytes(data=data, mime_type=mime_type), prompt]
    return _parse_json(_generate_with_retry(client, contents, system, json_mode=True))


# Async wrappers for request handlers. The SDK call is blocking (network + retries), so it
# runs in a worker thread and the event loop keeps serving other requests meanwhile.


async def agenerate(prompt: str, system: str | None = None) -> str:
    """Non-blocking ``generate`` for use inside async handlers."""
    return await asyncio.to_thread(generate, prompt, system)


async def aextract_json(prompt: str, system: str | None = None, stub: dict | None = None) -> dict:
    """Non-blocking ``extract_json`` for use inside async handlers."""
    return await asyncio.to_thread(extract_json, prompt, system, stub)


async def aextract_json_multimodal(
    prompt: str, data: bytes, mime_type: str, system: str | None = None
) -> dict:
    """Non-blocking ``extract_json_multimodal`` for use inside async handlers."""
    return await asyncio.to_thread(extract_json_multimodal, prompt, data, mime_type, system)
