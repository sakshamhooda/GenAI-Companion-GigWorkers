import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import check_database, create_tables
from app.routers import auth, chat, earnings, grievances, onboarding, voice
from app.seed import seed_demo

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    try:
        await create_tables()
        await seed_demo()
    except Exception as exc:  # noqa: BLE001
        log.warning("startup db setup failed: %s", exc)
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(earnings.router)
app.include_router(chat.router)
app.include_router(grievances.router)
app.include_router(onboarding.router)
app.include_router(voice.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "ok"}


@app.get("/health")
async def health() -> dict[str, str | bool]:
    """Liveness plus a database round-trip. Railway uses this as the healthcheck."""
    return {
        "status": "ok",
        "environment": settings.environment,
        "database": await check_database(),
        "llm": settings.gemini_api_key is not None,
    }
