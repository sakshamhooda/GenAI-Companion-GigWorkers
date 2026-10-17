import datetime as dt

from pydantic import BaseModel, Field, field_validator

from app.languages import DEFAULT_LANGUAGE, is_supported
from app.models import User
from app.util import split_csv


def _check_language(value: str) -> str:
    if not is_supported(value):
        raise ValueError(f"unsupported language code: {value}")
    return value


class UserOut(BaseModel):
    id: int
    phone: str
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
            name=user.name,
            language=user.language,
            work_types=split_csv(user.work_type),
            platforms=split_csv(user.platform),
            city=user.city,
            memory=user.memory or "",
            role=user.role,
        )


class RegisterIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15, pattern=r"^\d+$")
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    name: str = Field(min_length=1, max_length=100)
    language: str = DEFAULT_LANGUAGE
    work_types: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    city: str = ""
    # Legacy singular fields, folded into the lists.
    work_type: str = ""
    platform: str = ""

    @field_validator("language")
    @classmethod
    def _lang(cls, v: str) -> str:
        return _check_language(v)

    def all_work_types(self) -> list[str]:
        return self.work_types + split_csv(self.work_type)

    def all_platforms(self) -> list[str]:
        return self.platforms + split_csv(self.platform)


class LoginIn(BaseModel):
    phone: str
    pin: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class UserUpdate(BaseModel):
    name: str | None = None
    language: str | None = None
    work_types: list[str] | None = None
    platforms: list[str] | None = None
    city: str | None = None
    memory: str | None = None

    @field_validator("language")
    @classmethod
    def _lang(cls, v: str | None) -> str | None:
        return None if v is None else _check_language(v)


class LanguageOut(BaseModel):
    code: str
    name: str
    native: str
    sarvam: str
    tts: bool


class EarningIn(BaseModel):
    amount: float = Field(ge=0)
    expenses: float = Field(default=0, ge=0)
    platform: str = ""
    date: dt.date | None = None
    note: str = ""


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
    text: str = Field(min_length=1, max_length=1000)


class ParsedEarning(BaseModel):
    amount: float = 0
    expenses: float = 0
    platform: str = ""
    date: dt.date
    note: str = ""


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class ChatOut(BaseModel):
    reply: str


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class GrievanceIn(BaseModel):
    kind: str = Field(min_length=1, max_length=50)
    description: str = Field(min_length=1, max_length=4000)


class GrievanceOut(BaseModel):
    id: int
    kind: str
    description: str
    draft_local: str
    draft_english: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}
