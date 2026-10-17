from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import check_database

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    }
