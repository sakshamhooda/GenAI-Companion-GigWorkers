# Build context is the repo root (Railway builds without a root directory set).
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PORT=8000

COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first so this layer is cached across code changes.
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project || uv sync --no-dev --no-install-project

COPY backend/app ./app
COPY backend/alembic.ini ./alembic.ini
COPY backend/alembic ./alembic

RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
# Migrate first; if the migration fails the container exits and never serves traffic.
CMD ["sh", "-c", "/app/.venv/bin/alembic upgrade head && /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
