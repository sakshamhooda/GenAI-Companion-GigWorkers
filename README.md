# GenAI Companion for Gig Workers

A GenAI-powered assistant for gig and informal workers (delivery partners, drivers, daily-wage workers). It gives multilingual, plain-language help with earnings tracking, safety practices, rights and welfare schemes, documents, and grievance or dispute drafting.

Built for the PromptWars hackathon (Google for Developers + Hack2Skill).

## Try it

- App: https://frontend-production-2b281.up.railway.app
- API: https://backend-production-bffb.up.railway.app/health
- Demo worker login: phone `9999999999`, PIN `1234` (seeded with a week of earnings). Or register a new worker in your own language.

## Features (iteration 1)

| Capability | Where | How it works |
|---|---|---|
| Earnings tracking | Home, Earnings | Type "aaj 850 kamaye, 120 petrol". Gemini parses amount, expenses, platform and date; you confirm, it saves. Weekly net, total and expenses. |
| Safety practices | Chat | Ask in any language; answers use the worker's work type and city, with emergency numbers. |
| Rights and welfare schemes | Chat | Ask which schemes apply; answers use the profile (work type, state). |
| Document help | Chat | Describe the form or notice; get plain-language explanation of what to fill. |
| Grievance or dispute drafting | Help | Pick the issue, describe it, get a draft in your language and a formal English version, citing your logged earnings. Copy and send. |
| Multilingual, simple language | Everywhere | Profile language drives every reply. UI chrome in Hindi and English. |

Every reply is grounded in the worker's profile, their last seven days of earnings, and a short memory of their situation, so the flows connect: logged earnings become evidence in a complaint.

## Roadmap

- Conversational onboarding and a daily voice check-in (Sarvam speech-to-text, Gemini, Sarvam text-to-speech)
- Peer ratings of platforms by city, shown back to workers and cited in complaints
- Document photo understanding
- WhatsApp as a second channel sharing the same chat and memory (shown as "coming soon" in the profile)

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

- `backend`: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `CORS_ORIGINS=<frontend public URL>`, `ENVIRONMENT=production`, `SECRET_KEY`, `GEMINI_API_KEY`, `SARVAM_API_KEY` (optional), `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
- `frontend`: `NEXT_PUBLIC_API_URL=<backend public URL>`, `RAILWAY_DOCKERFILE_PATH=frontend/Dockerfile`

Without `GEMINI_API_KEY` the backend runs in stub mode: every endpoint works and returns placeholder text, so the app is testable without a key.

No secrets are committed. See the `.env.example` files for the variable names each service expects.
