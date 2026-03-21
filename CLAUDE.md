# CLAUDE.md

## Project Overview

Gym AI Tracker — an offline-first fitness tracking PWA with AI-powered routine generation, gamification, and progression tracking. Self-hosted on a mini PC with auto-deploy via GitHub webhooks.

## Tech Stack

- **Backend:** FastAPI (Python 3), SQLAlchemy 2.0, PostgreSQL 15, Alembic migrations
- **Frontend:** React 18 + TypeScript, Vite, Zustand (state), Dexie.js (IndexedDB offline storage), i18next
- **AI:** OpenAI GPT-4o via `openai` Python SDK
- **Infra:** Docker Compose, Nginx (dev), Caddy (prod with auto-HTTPS), GitHub webhook auto-deploy
- **Auth:** JWT access (15min) + refresh (7d) tokens, bcrypt, rate limiting via slowapi

## Project Structure

```
backend/
  app/
    main.py                # FastAPI entry point, CORS, router registration
    models/                # SQLAlchemy models (user, exercise, session, routine, quest, progression, etc.)
    routers/               # API routes (auth, sessions, sets, stats, ai, gamification, weight, progression, etc.)
    openai_service.py      # GPT-4o integration for routine generation + coach chat + reports
    progression_engine.py  # Algorithmic progression logic (double progression, RPE, plateau detection)
    progression_chains.py  # Bodyweight exercise progression chain definitions (12 chains)
    progression_summary.py # Builds structured user progress summaries for AI prompts
    gamification.py        # XP, levels, PR detection
    seed_data.py           # Exercise library seeder (~90KB)
  alembic/versions/        # DB migrations
  tests/                   # Pytest test suite
frontend/
  src/
    pages/               # Route pages (Dashboard, ActiveSession, Stats, ProgressionReport, etc.)
    components/          # Reusable UI (ExercisePicker, SetLogger, SuggestionBadge, CoachChat, etc.)
    hooks/               # Custom React hooks (useProgressionSuggestions, etc.)
    db/                  # Dexie schema + sync service for offline-first
    api/client.ts        # Axios wrapper with JWT auto-refresh
    stores/authStore.ts  # Zustand auth state
scheduler/               # Background job runner (Python)
deploy/                  # Prod config (Caddy, webhook, redeploy.sh)
```

## Development Commands

```bash
make up                # Start all containers (frontend :5173, API :8000, nginx :8080)
make down              # Stop containers
make logs              # Follow all container logs
make test              # Backend pytest + frontend type-check
make lint              # Flake8 (backend) + ESLint (frontend)
make shell-backend     # Shell into API container (run alembic commands here)
make shell-db          # psql shell into PostgreSQL
make build             # Full rebuild (no cache)
make quick-build       # Rebuild with cache
```

## Database Migrations

Alembic manages all schema changes. Run inside the backend container:

```bash
# Create a new migration after model changes:
docker compose exec api alembic revision --autogenerate -m "description"

# Apply migrations (dev):
docker compose exec api alembic upgrade head

# Apply migrations (prod, on mini PC):
make prod-migrate
```

Models live in `backend/app/models/` and must be imported in `backend/app/models/__init__.py` for autogenerate to detect them. Migration files are in `backend/alembic/versions/`.

## Seeding

The exercise library and demo account are seeded via Python modules:

```bash
# Dev:
docker compose exec api python -m app.seed_data    # Exercise catalog (~200+ exercises with difficulty, muscles, translations)
docker compose exec api python -m app.seed_demo    # Demo user account with sample data

# Prod (on mini PC):
make prod-seed
```

`seed_data.py` is idempotent — safe to re-run. It upserts exercises by name. `seed_demo.py` creates a demo account for testing.

## Testing

```bash
make test              # Runs pytest in container + frontend type-check
make lint              # Flake8 + ESLint
```

Backend tests are in `backend/tests/` using pytest with fixtures in `conftest.py`. Tests use a real test database (not mocks).

**Rule:** When adding new features or endpoints, always add corresponding tests. Run `make test` before pushing to ensure nothing is broken.

## Key Patterns

- **Offline-first:** Frontend stores data in IndexedDB (Dexie), syncs to backend when online. `syncQueue` table holds pending changes.
- **Routine structure:** Routines store days as a JSON array of day objects containing exercise references.
- **Gamification:** XP per session (base 50, scaled by history), PRs trigger bonus XP. Level-up costs `level * 100` XP.
- **AI generation:** User preferences + filtered exercise catalog sent to GPT-4o. Rate limited to 3/hour. Exercises referenced by ID only — AI cannot invent exercises.
- **Progression suggestions:** Three modes — (A) algorithmic quick suggestions via "Check Suggestions" button (no AI cost), (B) AI Coach Chat in RoutineDetails, (C) full Progression Report page (algorithmic + AI). Suggestions can be applied to both routine definition and active session sets. Lazy-fetch pattern: no automatic API calls, user triggers via button.
- **Bodyweight progression chains:** 12 predefined chains (push, pull, squat, hinge, core) stored in `exercise_progressions` table, seeded via migration. Chains define advancement criteria (target reps/sets/sessions).
- **Rate limiting:** slowapi on auth endpoints (3/day register, 5/min login), AI endpoints (3/hour), coach chat (5/hour), reports (3/hour).
- **i18n:** Translations in frontend via i18next. Translation files are large (~16KB).

## Environment Variables

Defined in `.env` (gitignored). Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `SECRET_KEY` — JWT signing
- `OPENAI_API_KEY` — For AI features
- `ALLOWED_ORIGINS` — CORS whitelist
- `WEBHOOK_SECRET` — GitHub webhook verification

## Production — Mini PC

The production server is a mini PC on the same local network, accessible via `ssh minipc` (alias in ~/.ssh/config). IP: `192.168.1.45`, user: `trota`, project path: `~/Documents/gym-AI-tracker`.

We can run commands on it directly from this machine:

```bash
# SSH and run a command:
ssh minipc "cd ~/Documents/gym-AI-tracker && make prod-logs"

# Or interactive shell:
ssh minipc
```

### Prod Makefile targets (run ON the mini PC or via ssh):

```bash
make prod-up           # Start all prod containers
make prod-build        # Rebuild + restart + migrate + seed (use after new packages)
make prod-restart      # Restart without rebuild
make prod-down         # Stop prod containers
make prod-logs         # Follow all logs
make prod-logs-api     # Follow API logs only
make prod-migrate      # Run Alembic migrations
make prod-seed         # Seed exercises + demo data
make prod-ps           # Show container status
```

### Auto-deploy flow

Push to `main` → GitHub webhook → mini PC runs `redeploy.sh` → git pull, docker compose build, up, alembic upgrade head. Live in ~60 seconds.

### When auto-deploy is not enough

- **New Python package in `requirements.txt`:** Requires a container rebuild. The webhook does rebuild, but if it fails, SSH and run `make prod-build`.
- **New env var needed:** SSH to mini PC, edit `~/Documents/gym-AI-tracker/.env`, then `make prod-restart`.
- **Check prod status:** `ssh minipc "cd ~/Documents/gym-AI-tracker && make prod-ps"`

## Progression Feature

Three user-facing modes, all accessible from RoutineDetails:

- **(A) Quick Suggestions:** `GET /api/progression/routine/{id}?day_index=X` — per-exercise algorithmic suggestions (double progression, RPE, plateau detection, bodyweight chains, cardio). Shown via `CheckSuggestionsButton` + `SuggestionBadge` in both RoutineDetails and ActiveSession.
- **(B) AI Coach Chat:** `POST /api/progression/chat` — collapsible `CoachChat` panel in RoutineDetails. Sends routine + progress summary to GPT-4o, returns structured suggestions with "Apply to Routine" actions.
- **(C) Progression Report:** `POST /api/progression/report/{id}` — full-page report at `/routines/:id/report`. Algorithmic analysis enriched by AI narrative. Per-exercise cards with Apply/Dismiss + "Apply All" batch action.

DB tables: `progression_reports`, `progression_feedback`, `exercise_progressions` (bodyweight chains).

Key files: `progression_engine.py` (algorithms), `progression_chains.py` (12 BW chains), `progression_summary.py` (AI prompt builder), `routers/progression.py` (5 endpoints).
