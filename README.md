# Saathi: GenAI Companion for Gig Workers

[![CI](https://github.com/sakshamhooda/GenAI-Companion-GigWorkers/actions/workflows/ci.yml/badge.svg)](https://github.com/sakshamhooda/GenAI-Companion-GigWorkers/actions/workflows/ci.yml)

A GenAI-powered assistant for gig and informal workers (delivery partners, drivers, home-service and daily-wage workers). Speak or type in any of 13 Indian languages to track earnings, get safety guidance, learn which welfare schemes you qualify for, understand documents, and draft a complaint that cites your own numbers.

Built for the PromptWars hackathon (Google for Developers + Hack2Skill).

## Try it

- App: https://frontend-production-2b281.up.railway.app
- API health: https://backend-production-bffb.up.railway.app/health

### Trying it without an account

Press **Continue with Google (demo)** on the login page. It signs you into a seeded demo worker with a week of earnings, no credentials needed. The button is replaced by real Google sign-in as soon as a Google OAuth client is configured. No login credentials are stored in this repository or shown in the app; an optional phone-and-PIN demo worker is seeded only from `DEMO_PHONE` and `DEMO_PIN` environment variables.

Or register a new worker: speak about your work, confirm what Saathi understood, set a PIN.

### Evaluator quick path

1. **Sign in** with the Google demo button on the login page. The interface follows the language switcher in the header.
2. **Log earnings in plain words** on Home: type or say "aaj 850 kamaye, 120 petrol". Saathi parses amount, expenses and platform; confirm to save. The weekly card updates.
3. **Ask for safety advice** in Chat: "raat ko delivery ke liye safety tips". The answer uses the worker's city and work, with emergency numbers.
4. **Draft a complaint** under Help: pick "payout deduction", describe it, and get a draft in Hindi and formal English that cites the logged earnings. Copy it.
5. **Open Profile** to see what Saathi remembers, edit platforms as chips, and find the WhatsApp "coming soon" card. Then log out and try **Register** with the mic to see conversational onboarding.

## Features

| Capability | Where | How it works |
|---|---|---|
| Earnings tracking | Home, Earnings | Natural-language or voice entry parsed by Gemini into amount, expenses, platform, date; confirm and save. Weekly net, total and expenses. |
| Safety practices | Chat | Guidance by work type, city and time, with emergency numbers. |
| Rights and welfare schemes | Chat | Which schemes apply to this worker's profile, explained simply. |
| Document help | Chat | Describe a form or notice and get plain-language help on what to fill. |
| Grievance or dispute drafting | Help | Draft in the worker's language and formal English, citing logged earnings. Copy and send. |
| Multilingual, simple language | Everywhere | 13 Indic UI languages; every model reply is in the worker's language and script. |
| Voice notes | Chat, Home, Onboarding | Mic button records up to 30 s; Sarvam transcribes, the worker edits the text, then sends. |
| Conversational onboarding | Register | Speak about your work; Saathi extracts name, languages, platforms, city, shift and a memory note; confirm on chips; set a PIN. |

Every reply is grounded in the worker's profile, their last seven days of earnings and a short memory note, so the flows connect: logged earnings become evidence in a complaint without retyping.

## Roadmap

- Daily voice check-in that logs earnings, incidents and a platform rating in one go
- Peer ratings of platforms by city, shown back to workers and cited in complaints; admin view
- Spoken replies (Sarvam text-to-speech) and document photo understanding
- WhatsApp as a second channel sharing the same chat and memory

## Architecture

Monorepo with two deployable services and a managed database, all on Railway. Details, diagrams and design decisions in [docs/architecture.md](docs/architecture.md).

| Path | Service | Stack | Deploy |
|---|---|---|---|
| `frontend/` | Web app | Next.js 16, React 19, Tailwind 4, TypeScript | Railway service `frontend` (Dockerfile) |
| `backend/` | API | FastAPI, async SQLAlchemy, Alembic, Python 3.12, uv | Railway service `backend` (Dockerfile) |
| Railway | Database | Postgres 18 with pgvector | Railway service `Postgres` |

AI providers: Google Gemini (`gemini-3.8-flash`) for all language tasks, Sarvam AI (`saaras:v4`) for Indic speech-to-text with Gemini audio as fallback. Without keys the backend runs in a stub mode so every endpoint still responds.

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, middleware, lifespan
│   │   ├── config.py        # settings from environment
│   │   ├── db.py            # async engine and sessions
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # request/response models
│   │   ├── auth.py          # PIN hashing, tokens, current user
│   │   ├── llm.py           # Gemini client with stub mode
│   │   ├── voice.py         # Sarvam STT with Gemini fallback
│   │   ├── context.py       # worker context and system prompt
│   │   ├── languages.py     # 13 supported languages
│   │   ├── seed.py          # demo data
│   │   └── routers/         # auth, earnings, chat, grievances, voice, onboarding
│   ├── alembic/             # migrations
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── app/                 # routes: landing, login, register, home, earnings, chat, grievance, profile
│   ├── components/          # AppShell, BottomNav, ChipGroup, MicButton, QuickAdd, ui
│   ├── lib/                 # api client, i18n strings
│   ├── tests/
│   └── Dockerfile
├── docs/                    # architecture, testing, accessibility
├── .github/workflows/ci.yml
└── docker-compose.yml
```

## Local development

Backend:

```bash
cd backend
# create backend/.env (gitignored) with DATABASE_URL and, optionally,
# GEMINI_API_KEY, SARVAM_API_KEY, SECRET_KEY; see the variables table in docs/architecture.md
uv sync --all-groups
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
# http://localhost:8000/health
```

Frontend:

```bash
cd frontend
# create frontend/.env.local (gitignored) with NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
# http://localhost:3000
```

Full stack with Docker (optional): `docker compose up --build`.

Hooks: `pre-commit install` runs lint, format and a secrets scan on every commit. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Tests and checks

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest --cov=app
cd frontend && npm run lint && npm test && npm run build
```

Backend tests run offline on SQLite with migrations applied; the LLM is stubbed. CI runs the same checks plus dependency audits on every push and pull request, for the service whose files changed. See [docs/testing.md](docs/testing.md).

## Security and accessibility

- [SECURITY.md](SECURITY.md): threat model, rate limits, token expiry, headers, how to report.
- [docs/accessibility.md](docs/accessibility.md): what the UI does for phones, screen readers and 13 languages, plus a manual checklist.

## Deployment

Both services build from the repo root; `RAILWAY_DOCKERFILE_PATH` selects the Dockerfile. Pushes to `main` deploy automatically. The backend runs `alembic upgrade head` before starting.

Required service variables on Railway:

- `backend`: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `CORS_ORIGINS=<frontend URL>`, `ENVIRONMENT=production`, `SECRET_KEY`, `GEMINI_API_KEY`, `SARVAM_API_KEY` (optional), `GOOGLE_CLIENT_ID` (optional), `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`
- `frontend`: `NEXT_PUBLIC_API_URL=<backend URL>`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional), `RAILWAY_DOCKERFILE_PATH=frontend/Dockerfile`

No secrets or environment files are committed. The full variable list with defaults is in [docs/architecture.md](docs/architecture.md).
