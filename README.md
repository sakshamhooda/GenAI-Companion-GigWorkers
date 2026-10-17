# GenAI Companion for Gig Workers

A GenAI-powered assistant for gig and informal workers (delivery partners, drivers, daily-wage workers). It gives multilingual, plain-language help with earnings tracking, safety practices, rights and welfare schemes, documents, and grievance or dispute drafting.

Built for the PromptWars hackathon (Google for Developers + Hack2Skill).

## Architecture

Monorepo with two deployable services and a managed database, all on Railway.

| Path | Service | Stack | Deploy |
|---|---|---|---|
| `frontend/` | Web app | Next.js 16, React 19, Tailwind 4, TypeScript | Railway service `frontend` (Dockerfile) |
| `backend/` | API | FastAPI, SQLAlchemy (async), Python 3.12, uv | Railway service `backend` (Dockerfile) |
| Railway | Database | Postgres 18 with pgvector | Railway service `Postgres` |

The backend reaches Postgres over Railway's private network. The frontend calls the backend over its public URL via `NEXT_PUBLIC_API_URL`.

## Local development

Backend:

```bash
cd backend
cp .env.example .env        # fill in DATABASE_URL
uv sync --all-groups
uv run uvicorn app.main:app --reload
# http://localhost:8000/health
```

Frontend:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
# http://localhost:3000
```

Full stack with Docker (optional):

```bash
docker compose up --build
```

## Tests and checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run lint && npm run build
```

CI runs the same checks on every push and pull request (`.github/workflows/ci.yml`), building only the service whose files changed.

## Deployment

Each service has a `railway.json` that points Railway at its Dockerfile and healthcheck. Both Dockerfiles use the repo root as build context. Pushes to `main` deploy automatically once the Railway services are linked to this repo.

Required service variables on Railway:

- `backend`: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `CORS_ORIGINS=<frontend public URL>`, `ENVIRONMENT=production`
- `frontend`: `NEXT_PUBLIC_API_URL=<backend public URL>`

No secrets are committed. See the `.env.example` files for the variable names each service expects.
