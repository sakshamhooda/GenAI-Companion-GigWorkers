"""Thin Gemini client. Runs in stub mode when no API key is configured."""

import json
import logging
from typing import Any

from app.config import settings

log = logging.getLogger(__name__)

STUB_TEXT = "[stub] Saathi is running without an LLM key. This is a placeholder reply."
STUB_JSON: dict[str, Any] = {"stub": True}

_client = None


def _get_client():
    global _client
    if _client is None and settings.gemini_api_key:
        from google import genai

        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _config(system: str | None, json_mode: bool):
    from google.genai import types

    return types.GenerateContentConfig(
        system_instruction=system,
        thinking_config=types.ThinkingConfig(thinking_budget=0),
        response_mime_type="application/json" if json_mode else None,
        temperature=0.4,
    )


def generate(prompt: str, system: str | None = None) -> str:
    """Return plain text from the model, or a safe fallback."""
    client = _get_client()
    if client is None:
        return STUB_TEXT
    try:
        res = client.models.generate_content(
            model=settings.gemini_model, contents=prompt, config=_config(system, False)
        )
        return (res.text or "").strip() or "Sorry, I could not generate a reply. Please try again."
    except Exception as exc:  # noqa: BLE001
        log.warning("gemini generate failed: %s", exc)
        return "Sorry, I am having trouble right now. Please try again in a moment."


def extract_json(prompt: str, system: str | None = None, stub: dict | None = None) -> dict:
    """Ask the model for JSON and parse it. Returns `stub` (or {}) on failure or without a key."""
    client = _get_client()
    if client is None:
        return dict(stub) if stub is not None else dict(STUB_JSON)
    try:
        res = client.models.generate_content(
            model=settings.gemini_model, contents=prompt, config=_config(system, True)
        )
        data = json.loads(res.text or "{}")
        return data if isinstance(data, dict) else {}
    except Exception as exc:  # noqa: BLE001
        log.warning("gemini extract_json failed: %s", exc)
        return dict(stub) if stub is not None else {}
