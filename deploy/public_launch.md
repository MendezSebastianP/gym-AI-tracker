# Public Launch Checklist

This checklist is for the real production deployment on the mini PC behind Caddy at:

- `https://gym-ai-tracker.duckdns.org/`

The local repo is only the staging/dev workspace. Public launch steps are not complete until they are applied on the mini PC deployment.

## Required environment on the mini PC

Set these values in the production `.env` used by Docker Compose:

```bash
APP_ENV=production
SECRET_KEY=replace_with_long_random_secret
DATABASE_URL=postgresql://postgres:***@postgres:5432/gym_tracker
OPENAI_API_KEY=sk-...
ADMIN_EMAILS=your-real-login@example.com
WEBHOOK_SECRET=replace_with_webhook_secret
VITE_PUBLIC_OPERATOR_NAME=Your Real Name
VITE_PUBLIC_SUPPORT_EMAIL=your-public-support@example.com
VITE_PUBLIC_LEGAL_EFFECTIVE_DATE=2026-03-29
```

Notes:

- `SECRET_KEY`, `DATABASE_URL`, and `OPENAI_API_KEY` are required when `APP_ENV=production`.
- `ADMIN_EMAILS` is the allowlist that promotes real admin accounts on login/auth refresh.
- `VITE_PUBLIC_OPERATOR_NAME` and `VITE_PUBLIC_SUPPORT_EMAIL` must be real public contact details before the site is shown publicly.

## Before deploying

1. Back up the database.

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec -T api \
  python -m app.db_export_import export /app/backup_prelaunch.json
docker cp $(docker compose ps -q api):/app/backup_prelaunch.json ./backups/
```

2. If you are about to run migrations, also take a Postgres dump:

```bash
./deploy/backup.sh
```

3. Confirm the exercise catalog can be re-seeded:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec api python -m app.seed_data
```

## Deploy checklist

1. Pull/build/redeploy on the mini PC.
2. Run migrations:

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec api alembic upgrade head
```

3. Confirm the API starts cleanly with production env values.
4. Confirm the frontend picks up the public legal env values.

## Caddy / routing checks

Verify direct requests succeed:

- `/`
- `/privacy`
- `/terms`
- `/login`
- `/register`

Because the app is a SPA, Caddy must keep forwarding unknown frontend routes to the frontend service. The current catch-all in `deploy/Caddyfile` should remain intact.

## Public smoke test on the live domain

Run these on `https://gym-ai-tracker.duckdns.org/` after deploy:

1. Register a new account.
2. Log in.
3. Confirm `/privacy` and `/terms` are reachable from landing, login, register, and settings.
4. Create a routine.
5. Start and finish a session.
6. Open stats.
7. Use one AI feature.
8. Log out and log back in.
9. Confirm admin routes return `403` for a normal user.
10. Confirm your real admin account can open `/admin`.

## Backup / restore drill

Do not rely on backups until this path has been tested on a safe environment:

1. Export with `python -m app.db_export_import export`.
2. Rebuild a safe database.
3. Run `python -m app.seed_data`.
4. Import with `python -m app.db_export_import import`.
5. Verify users, routines, sessions, set types, effort data, and gamification state survived the round trip.

## AI / legal / cookies notes

- AI output is assistive only; the public legal pages disclose this.
- The app currently uses browser storage (`localStorage`, `IndexedDB`) for auth continuity and offline data.
- No non-essential analytics or marketing cookies are disclosed in v1, so there is no cookie banner in this release.
- If analytics, ads, or third-party trackers are added later, update the privacy policy and add a consent flow before release.

## Secret rotation / emergency actions

- Rotate `SECRET_KEY` if token signing is ever suspected to be compromised.
- Rotate `OPENAI_API_KEY` if AI provider credentials are leaked or abused.
- Remove an email from `ADMIN_EMAILS` to strip admin access on the next authenticated request.
- Restore from backup before attempting destructive manual database repair.
