from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, get_current_user, hash_pin, verify_pin
from app.db import get_session
from app.languages import language_list
from app.models import User
from app.schemas import AuthOut, LanguageOut, LoginIn, RegisterIn, UserOut, UserUpdate
from app.util import join_csv

router = APIRouter(tags=["auth"])


@router.get("/languages", response_model=list[LanguageOut])
async def languages() -> list[LanguageOut]:
    return [LanguageOut(**item) for item in language_list()]


@router.post("/auth/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, session: AsyncSession = Depends(get_session)) -> AuthOut:
    existing = await session.scalar(select(User).where(User.phone == body.phone))
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
    user = User(
        phone=body.phone,
        pin_hash=hash_pin(body.pin),
        name=body.name,
        language=body.language,
        work_type=join_csv(body.all_work_types()),
        platform=join_csv(body.all_platforms()),
        city=body.city,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user))


@router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)) -> AuthOut:
    user = await session.scalar(select(User).where(User.phone == body.phone))
    if user is None or not verify_pin(body.pin, user.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or PIN")
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_user(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    data = body.model_dump(exclude_none=True)
    if "work_types" in data:
        user.work_type = join_csv(data.pop("work_types"))
    if "platforms" in data:
        user.platform = join_csv(data.pop("platforms"))
    for field, value in data.items():
        setattr(user, field, value)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserOut.from_user(user)
