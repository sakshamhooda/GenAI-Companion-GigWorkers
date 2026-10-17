"""Pure unit tests: no HTTP, no database."""

from datetime import date

import pytest

from app import auth, llm
from app.config import settings
from app.context import SYSTEM_PROMPT, build_context, system_prompt_for
from app.languages import LANGUAGES, reply_instruction
from app.models import Earning, User
from app.util import join_csv, split_csv


def test_split_csv_trims_and_drops_empties() -> None:
    assert split_csv("Zomato, Swiggy,,") == ["Zomato", "Swiggy"]
    assert split_csv(None) == []
    assert split_csv("") == []


def test_join_csv_dedupes_and_keeps_order() -> None:
    assert join_csv(["Uber", " Uber", "Ola", ""]) == "Uber,Ola"
    assert join_csv(None) == ""


def test_languages_table_is_complete() -> None:
    assert len(LANGUAGES) == 13
    for code, info in LANGUAGES.items():
        assert info["name"] and info["native"], code
        assert info["sarvam"].endswith("-IN"), code


def test_reply_instruction_names_native_language() -> None:
    assert "தமிழ்" in reply_instruction("ta")
    assert "Indian English" in reply_instruction("en")
    assert "اردو" in reply_instruction("ur")


def test_pin_hash_roundtrip_and_salt() -> None:
    h1 = auth.hash_pin("1234")
    h2 = auth.hash_pin("1234")
    assert h1 != h2  # fresh salt each time
    assert auth.verify_pin("1234", h1) and auth.verify_pin("1234", h2)
    assert not auth.verify_pin("0000", h1)
    assert not auth.verify_pin("1234", "garbage-without-separator")


def test_token_roundtrip() -> None:
    token = auth.create_token(42)
    assert auth.decode_token(token) == 42
    assert auth.decode_token(token + "x") is None
    assert auth.decode_token("") is None


def test_token_expiry(monkeypatch: pytest.MonkeyPatch) -> None:
    token = auth.create_token(7)
    assert auth.decode_token(token) == 7
    monkeypatch.setattr(settings, "token_ttl_seconds", -1)
    assert auth.decode_token(token) is None


def test_llm_stub_mode() -> None:
    settings.gemini_api_key = None
    llm._client = None
    assert llm.generate("hello") == llm.STUB_TEXT
    assert llm.extract_json("x", stub={"amount": 0}) == {"amount": 0}
    assert llm.extract_json("x") == llm.STUB_JSON


def test_parse_json_tolerates_fences_and_garbage() -> None:
    assert llm._parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert llm._parse_json("not json") == {}
    assert llm._parse_json("[1, 2]") == {}
    assert llm._parse_json(None) == {}


def _user(**overrides) -> User:
    base = dict(
        phone="7000000000",
        pin_hash="x",
        name="Asha",
        language="ta",
        work_type="driver,delivery",
        platform="Uber,Rapido",
        city="Chennai",
        memory="Drives nights.",
    )
    base.update(overrides)
    return User(**base)


def test_build_context_lists_platforms_and_language() -> None:
    user = _user()
    earnings = [
        Earning(user_id=1, date=date(2026, 10, 10), amount=700, expenses=100, platform="Uber"),
        Earning(user_id=1, date=date(2026, 10, 11), amount=300, expenses=0, platform=""),
    ]
    ctx = build_context(user, earnings)
    assert "platforms: Uber, Rapido" in ctx
    assert "work types: driver, delivery" in ctx
    assert "LANGUAGE: தமிழ் (Tamil)" in ctx
    assert "Drives nights." in ctx
    assert "net ₹900" in ctx
    # an entry with no platform falls back to the worker's first platform
    assert "2026-10-11: earned ₹300, expenses ₹0, Uber" in ctx


def test_build_context_without_earnings() -> None:
    ctx = build_context(_user(memory=""), [])
    assert "no entries yet" in ctx
    assert "MEMORY NOTES" not in ctx


def test_system_prompt_for_appends_language() -> None:
    prompt = system_prompt_for(_user(language="od"))
    assert prompt.startswith(SYSTEM_PROMPT)
    assert "ଓଡ଼ିଆ" in prompt
