"""Registration, login (phone + PIN or Google), profile and the public languages list."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ratelimit
from app.auth import create_token, get_current_user, hash_pin, verify_pin
from app.config import settings
from app.db import get_session
from app.languages import DEFAULT_LANGUAGE, language_list
from app.models import User
from app.schemas import (
    AuthOut,
    GoogleIn,
    LanguageOut,
    LoginIn,
    RegisterIn,
    UserOut,
    UserUpdate,
)
from app.util import join_csv

log = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])

LOGIN_LOCKOUT_WINDOW = 15 * 60
DEMO_GOOGLE_CREDENTIAL = "demo"
DEMO_GOOGLE_SUB = "demo-google"


async def _demo_google_user(session: AsyncSession) -> AuthOut:
    """Find or create the seeded Google-style demo worker (demo mode only)."""
    user = await session.scalar(select(User).where(User.google_sub == DEMO_GOOGLE_SUB))
    is_new = user is None
    if user is None:
        user = User(
            phone=None,
            pin_hash="",
            google_sub=DEMO_GOOGLE_SUB,
            email="demo.google@saathi.app",
            name="Demo (Google)",
            language="hi",
            work_type=join_csv(["driver"]),
            platform=join_csv(["Uber"]),
            city="Pune",
            memory="",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user), is_new=is_new)


@router.get("/auth/google/config")
async def google_config() -> dict[str, bool]:
    """Public: tells the frontend whether to render the real button, the demo button, or nothing."""
    enabled = bool(settings.google_client_id)
    return {"enabled": enabled, "demo": (not enabled) and settings.google_demo_mode}


@router.get("/languages", response_model=list[LanguageOut])
async def languages(response: Response) -> list[LanguageOut]:
    response.headers["Cache-Control"] = "public, max-age=3600"
    return [LanguageOut(**item) for item in language_list()]


@router.post(
    "/auth/register",
    response_model=AuthOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ratelimit.per_ip("register", 5))],
)
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
        memory=body.initial_memory(),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user), is_new=True)


@router.post(
    "/auth/login",
    response_model=AuthOut,
    dependencies=[Depends(ratelimit.per_ip("login", 10))],
)
async def login(
    body: LoginIn, request: Request, session: AsyncSession = Depends(get_session)
) -> AuthOut:
    # Per-phone lockout: 5 attempts per 15 minutes regardless of source IP.
    ratelimit.check(f"login:phone:{body.phone}", 5, LOGIN_LOCKOUT_WINDOW)
    user = await session.scalar(select(User).where(User.phone == body.phone))
    if user is None or not user.pin_hash or not verify_pin(body.pin, user.pin_hash):
        log.info("failed login from %s", ratelimit.client_ip(request))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong phone or PIN")
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user))


@router.post(
    "/auth/google",
    response_model=AuthOut,
    dependencies=[Depends(ratelimit.per_ip("google", 10))],
)
async def google_sign_in(body: GoogleIn, session: AsyncSession = Depends(get_session)) -> AuthOut:
    """Exchange a Google Identity Services ID token for a Saathi session.

    Without a client id, demo mode (``GOOGLE_DEMO_MODE=true``) accepts the literal
    credential "demo" and signs in a seeded Google-style worker so the flow can be shown.
    With a client id configured, demo credentials are never accepted.
    """
    if not settings.google_client_id:
        if settings.google_demo_mode and body.credential == DEMO_GOOGLE_CREDENTIAL:
            return await _demo_google_user(session)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in not configured")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), settings.google_client_id
        )
    except Exception as exc:  # noqa: BLE001  (any verification failure is a 401)
        log.info("google token rejected: %s", type(exc).__name__)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token") from None
    sub = str(claims.get("sub") or "")
    email = claims.get("email") if claims.get("email_verified") else None
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")

    user = await session.scalar(select(User).where(User.google_sub == sub))
    is_new = False
    if user is None and email:
        user = await session.scalar(select(User).where(User.email == email))
        if user is not None:
            user.google_sub = sub
    if user is None:
        is_new = True
        user = User(
            phone=None,
            pin_hash="",
            google_sub=sub,
            email=email,
            name=str(claims.get("given_name") or claims.get("name") or "")[:80],
            language=DEFAULT_LANGUAGE,
            work_type="",
            platform="",
            city="",
            memory="",
        )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthOut(token=create_token(user.id), user=UserOut.from_user(user), is_new=is_new)


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
