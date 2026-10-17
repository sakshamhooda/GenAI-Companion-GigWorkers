# Testing

## Backend

Tests live in `backend/tests/` and run offline against SQLite, so no database, keys or network are needed. Alembic migrations are applied to the test database first, which also checks that every migration runs.

```bash
cd backend
uv sync --all-groups
uv run pytest                          # all tests
uv run pytest -q tests/test_flows.py   # one file
uv run pytest --cov=app --cov-report=term-missing
```

What is covered:

- **Unit**: PIN hashing and token signing/expiry, CSV helpers, language validation and reply instructions, context building, JSON parsing of model output (including fenced output), the stub LLM path, speech fallback order.
- **API flows**: register → login → `/me` → earnings add/parse/summary → chat → grievance draft, with the LLM stubbed so results are deterministic.
- **Guards**: wrong PIN, expired token, rate limit responses, oversized or non-audio uploads, unsupported language codes.

To exercise the real providers locally, put keys in `backend/.env` and run the server; the tests themselves never read them.

## Frontend

Vitest with React Testing Library, in `frontend/tests/`.

```bash
cd frontend
npm test              # run once
npm run test:watch    # watch mode
```

What is covered:

- `lib/api.ts`: token attachment, error mapping, 401 handling.
- `lib/i18n.ts`: every one of the 13 languages has every key, and `t()` falls back safely.
- Components: `ChipGroup` toggling and custom values, `QuickAdd` parse → confirm → save, `MicButton` hidden when `MediaRecorder` is unavailable.

## CI

`.github/workflows/ci.yml` runs on every push and pull request. A path filter picks jobs:

| Job | Runs when | Steps |
|---|---|---|
| backend | `backend/**` changed | ruff check, ruff format check, pytest with coverage threshold, pip-audit |
| frontend | `frontend/**` changed | eslint, vitest, next build, npm audit |

Dependabot opens weekly update PRs for both services and the workflow actions.

## Adding a test

- Backend: add a function in the matching `tests/test_*.py`; use the `client` fixture for HTTP and the `session` fixture for direct DB access. Keep LLM calls stubbed by leaving `GEMINI_API_KEY` unset (the fixtures do this).
- Frontend: add `tests/<name>.test.tsx`; render with `@testing-library/react`, mock `fetch` with `vi.fn()` for API calls.
- Name tests after the behaviour, not the function: `test_wrong_pin_is_rejected`, not `test_login_2`.
