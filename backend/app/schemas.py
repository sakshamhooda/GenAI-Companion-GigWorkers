"""Request and response models. Field limits here are the API's input-validation layer."""

import datetime as dt

from pydantic import BaseModel, Field, field_validator

from app.languages import DEFAULT_LANGUAGE, is_supported
from app.models import User
from app.util import split_csv

PHONE_PATTERN = r"^[6-9]\d{9}$"
PIN_PATTERN = r"^\d{4}$"
MAX_LIST_ITEMS = 10
MAX_LIST_ITEM_LEN = 40


def _check_language(value: str) -> str:
    if not is_supported(value):
        raise ValueError(f"unsupported language code: {value}")
    return value


def _check_list(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    if len(values) > MAX_LIST_ITEMS:
        raise ValueError(f"at most {MAX_LIST_ITEMS} items")
    cleaned = []
    for v in values:
        v = str(v).strip()
        if not v:
            continue
        if len(v) > MAX_LIST_ITEM_LEN:
            raise ValueError(f"items must be at most {MAX_LIST_ITEM_LEN} characters")
        cleaned.append(v)
    return cleaned


class UserOut(BaseModel):
    id: int
    phone: str | None
    email: str | None = None
    name: str
    language: str
    work_types: list[str]
    platforms: list[str]
    city: str
    memory: str
    role: str

    @classmethod
    def from_user(cls, user: User) -> "UserOut":
        return cls(
            id=user.id,
            phone=user.phone,
            email=getattr(user, "email", None),
            name=user.name,
            language=user.language,
            work_types=split_csv(user.work_type),
            platforms=split_csv(user.platform),
            city=user.city,
            memory=user.memory or "",
            role=user.role,
        )


class RegisterIn(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    pin: str = Field(pattern=PIN_PATTERN)
    name: str = Field(min_length=1, max_length=80)
    language: str = DEFAULT_LANGUAGE
    work_types: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    city: str = Field(default="", max_length=80)
    memory: str = Field(default="", max_length=2000)
    shift: str | None = Field(default=None, max_length=50)
    # Legacy singular fields, folded into the lists.
    work_type: str = Field(default="", max_length=MAX_LIST_ITEM_LEN)
    platform: str = Field(default="", max_length=MAX_LIST_ITEM_LEN)

    @field_validator("language")
    @classmethod
    def _lang(cls, v: str) -> str:
        return _check_language(v)

    @field_validator("work_types", "platforms")
    @classmethod
    def _lists(cls, v: list[str]) -> list[str]:
        return _check_list(v) or []

    def all_work_types(self) -> list[str]:
        return self.work_types + split_csv(self.work_type)

    def all_platforms(self) -> list[str]:
        return self.platforms + split_csv(self.platform)

    def initial_memory(self) -> str:
        memory = self.memory.strip()
        if self.shift and self.shift.lower() not in memory.lower():
            memory = f"{memory} Usually works {self.shift} shifts.".strip()
        return memory


class OnboardingIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language_hint: str | None = Field(default=None, max_length=5)


class OnboardingOut(BaseModel):
    name: str | None = None
    language: str | None = None
    work_types: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    city: str | None = None
    shift: str | None = None
    years_experience: float | None = None
    memory: str = ""


class TranscriptOut(BaseModel):
    transcript: str
    language_code: str | None = None
    language_probability: float | None = None
    provider: str


class LoginIn(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    pin: str = Field(pattern=PIN_PATTERN)


class GoogleIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)


class AuthOut(BaseModel):
    token: str
    user: UserOut
    is_new: bool = False


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    language: str | None = None
    work_types: list[str] | None = None
    platforms: list[str] | None = None
    city: str | None = Field(default=None, max_length=80)
    memory: str | None = Field(default=None, max_length=2000)

    @field_validator("language")
    @classmethod
    def _lang(cls, v: str | None) -> str | None:
        return None if v is None else _check_language(v)

    @field_validator("work_types", "platforms")
    @classmethod
    def _lists(cls, v: list[str] | None) -> list[str] | None:
        return _check_list(v)


class LanguageOut(BaseModel):
    code: str
    name: str
    native: str
    sarvam: str
    tts: bool


class EarningIn(BaseModel):
    amount: float = Field(ge=0, le=1_000_000)
    expenses: float = Field(default=0, ge=0, le=1_000_000)
    platform: str = Field(default="", max_length=MAX_LIST_ITEM_LEN)
    date: dt.date | None = None
    note: str = Field(default="", max_length=500)


class EarningOut(BaseModel):
    id: int
    date: dt.date
    amount: float
    expenses: float
    platform: str
    note: str

    model_config = {"from_attributes": True}


class EarningsSummary(BaseModel):
    entries: list[EarningOut]
    total_amount: float
    total_expenses: float
    net: float


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ParsedEarning(BaseModel):
    amount: float = 0
    expenses: float = 0
    platform: str = ""
    date: dt.date
    note: str = ""


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatOut(BaseModel):
    reply: str


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class GrievanceIn(BaseModel):
    kind: str = Field(min_length=1, max_length=50, pattern=r"^[a-z_]+$")
    description: str = Field(min_length=1, max_length=4000)


class GrievanceOut(BaseModel):
    id: int
    kind: str
    description: str
    draft_local: str
    draft_english: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}
