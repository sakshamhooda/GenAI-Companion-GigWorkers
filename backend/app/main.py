import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.config import DEFAULT_SECRET_KEY, settings
from app.db import check_database
from app.llm import LLMUnavailable
from app.routers import (
    auth,
    chat,
    connectors,
    earnings,
    grievances,
    onboarding,
    problems,
    voice,
)
from app.security import SecurityHeadersMiddleware
from app.seed import seed_demo

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Schema is managed by Alembic (run before the server starts); only seed here."""
    if settings.is_production and settings.secret_key == DEFAULT_SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set in production")
    try:
        await seed_demo()
    except Exception as exc:  # noqa: BLE001
        log.warning("startup seed failed: %s", exc)
    yield


app = FastAPI(title=settings.app_name, version="0.3.0", lifespan=lifespan)

# Middleware order: the last added runs outermost. CORS must be outermost so error
# responses (429, 500) still carry CORS headers for the browser.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(earnings.router)
app.include_router(chat.router)
app.include_router(grievances.router)
app.include_router(onboarding.router)
app.include_router(voice.router)
app.include_router(connectors.router)
app.include_router(problems.router)


@app.exception_handler(LLMUnavailable)
async def llm_unavailable(request: Request, exc: LLMUnavailable) -> JSONResponse:
    """The model is down after retries: tell the client to retry instead of serving stubs."""
    log.warning("llm unavailable on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "AI is busy right now, please try again in a moment"},
        headers={"Retry-After": "5"},
    )


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    """Never leak stack traces to clients; log them server-side."""
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "internal error"})


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
