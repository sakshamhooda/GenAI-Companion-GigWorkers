"""Supported worker languages.

Codes follow the Sarvam Saaras speech-to-text list (BCP-47 in `sarvam`).
`tts` marks languages Bulbul text-to-speech can speak.
"""

LANGUAGES: dict[str, dict[str, str | bool]] = {
    "hi": {"name": "Hindi", "native": "हिन्दी", "sarvam": "hi-IN", "tts": True},
    "en": {"name": "English", "native": "English", "sarvam": "en-IN", "tts": True},
    "bn": {"name": "Bengali", "native": "বাংলা", "sarvam": "bn-IN", "tts": True},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "sarvam": "gu-IN", "tts": True},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "sarvam": "kn-IN", "tts": True},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "sarvam": "ml-IN", "tts": True},
    "mr": {"name": "Marathi", "native": "मराठी", "sarvam": "mr-IN", "tts": True},
    "od": {"name": "Odia", "native": "ଓଡ଼ିଆ", "sarvam": "od-IN", "tts": True},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "sarvam": "pa-IN", "tts": True},
    "ta": {"name": "Tamil", "native": "தமிழ்", "sarvam": "ta-IN", "tts": True},
    "te": {"name": "Telugu", "native": "తెలుగు", "sarvam": "te-IN", "tts": True},
    "as": {"name": "Assamese", "native": "অসমীয়া", "sarvam": "as-IN", "tts": False},
    "ur": {"name": "Urdu", "native": "اردو", "sarvam": "ur-IN", "tts": False},
}

DEFAULT_LANGUAGE = "hi"


def is_supported(code: str | None) -> bool:
    """True when `code` is one of the short codes in LANGUAGES."""
    return bool(code) and code in LANGUAGES


def language_list() -> list[dict[str, str | bool]]:
    """Serialisable list for `GET /languages`, one entry per supported language."""
    return [{"code": code, **info} for code, info in LANGUAGES.items()]


def reply_instruction(code: str) -> str:
    """One explicit sentence telling the model which language and script to answer in."""
    info = LANGUAGES.get(code, LANGUAGES[DEFAULT_LANGUAGE])
    if code == "en":
        return "Reply in simple Indian English. Use simple short sentences."
    return (
        f"Reply in {info['native']} ({info['name']}), written in its own native script, "
        "not in English and not transliterated. Use simple short sentences."
    )
