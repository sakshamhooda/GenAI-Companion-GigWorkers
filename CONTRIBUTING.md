# Contributing

## Setup

```bash
# backend (create backend/.env with DATABASE_URL first; variables are listed in docs/architecture.md)
cd backend && uv sync --all-groups
# frontend (create frontend/.env.local with NEXT_PUBLIC_API_URL=http://localhost:8000)
cd frontend && npm install
# hooks (from the repo root)
pipx install pre-commit   # or: uv tool install pre-commit
pre-commit install
```

`pre-commit` runs ruff, eslint, whitespace fixes and a secrets scan (gitleaks) on every commit. Run it on everything with `pre-commit run --all-files`.

## Branches and pull requests

- Branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`.
- Keep PRs small and scoped to one service where possible; CI only runs the jobs for the paths you touched.
- A PR needs green CI (lint, format, tests, build, dependency audit) before merge.
- Merging to `main` deploys both Railway services automatically.

## Commit messages

- Imperative subject under 72 characters, blank line, then the why in a few sentences.
- Plain text. No emoji, no issue-tracker prefixes, no attribution trailers.

## Tests

Every change to a router, model or component ships with a test. See [docs/testing.md](docs/testing.md).

## Secrets

Never commit `.env*` files or paste keys into code, commits, logs or tests. Variable names are documented in `docs/architecture.md`, not in example files. See [SECURITY.md](SECURITY.md) for reporting.
