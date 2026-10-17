import datetime as dt

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    phone: str
    name: str
    language: str
    work_type: str
    platform: str
    city: str
    memory: str
    role: str

    model_config = {"from_attributes": True}


class RegisterIn(BaseModel):
    phone: str = Field(min_length=10, max_length=15, pattern=r"^\d+$")
    pin: str = Field(min_length=4, max_length=4, pattern=r"^\d{4}$")
    name: str = Field(min_length=1, max_length=100)
    language: str = "hi"
    work_type: str = ""
    platform: str = ""
    city: str = ""


class LoginIn(BaseModel):
    phone: str
    pin: str


class AuthOut(BaseModel):
    token: str
    user: UserOut


class UserUpdate(BaseModel):
    name: str | None = None
    language: str | None = None
    work_type: str | None = None
    platform: str | None = None
    city: str | None = None
    memory: str | None = None


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
