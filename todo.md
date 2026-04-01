# Mini PC Todo

## Required before public launch

1. Set real production environment values on the mini PC:
   - `APP_ENV=production`
   - `SECRET_KEY`
   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `ADMIN_EMAILS`
   - `VITE_PUBLIC_OPERATOR_NAME`
   - `VITE_PUBLIC_SUPPORT_EMAIL`
   - `VITE_PUBLIC_LEGAL_EFFECTIVE_DATE`
   - `WEBHOOK_SECRET`

2. Put your real personal public identity in the legal env values:
   - `VITE_PUBLIC_OPERATOR_NAME=Your Real Name`
   - `VITE_PUBLIC_SUPPORT_EMAIL=your-public-contact@example.com`

3. Make sure the real admin account email is listed in:
   - `ADMIN_EMAILS`

4. Deploy the new code on the mini PC.

5. Run database migrations on production:
   - `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec api alembic upgrade head`

6. Verify Caddy serves SPA routes correctly on the public domain:
   - `/`
   - `/privacy`
   - `/terms`
   - `/login`
   - `/register`

7. Run the public smoke test on `https://gym-ai-tracker.duckdns.org/`:
   - Register
   - Login
   - Create routine
   - Start session
   - Finish session
   - Open stats
   - Use one AI feature
   - Logout and login again
   - Check legal links from landing, login, register, settings
   - Check non-admin gets blocked from `/admin`
   - Check your admin account can open `/admin`

8. Back up the production DB before any destructive change:
   - app JSON export
   - PostgreSQL dump

9. Test restore on a safe environment before trusting backups:
   - export
   - rebuild DB
   - `python -m app.seed_data`
   - import
   - verify routines, sessions, set types, effort data, gamification data

10. Confirm the privacy/terms pages show the final real contact details, not placeholders.

11. Keep cookie handling as-is for v1:
   - no cookie banner yet
   - if analytics/ads/third-party trackers are added later, update privacy + add consent flow first

12. If needed later, rotate these secrets quickly:
   - `SECRET_KEY`
   - `OPENAI_API_KEY`
   - `WEBHOOK_SECRET`
