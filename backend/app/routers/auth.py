from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, get_current_user, hash_pin, verify_pin
from app.db import get_session
from app.models import User
from app.schemas import AuthOut, LoginIn, RegisterIn, UserOut, UserUpdate

router = APIRouter(tags=["auth"])


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
        work_type=body.work_type,
        platform=body.platform,
        city=body.city,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthOut(token=create_token(user.id), user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn, session: AsyncSession = Depends(get_session)) -> AuthOut:
    user = await session.scalar(select(User).where(User.phone == body.phone))
    if user is None or not verify_pin(body.pin, user.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or PIN")
    return AuthOut(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)
