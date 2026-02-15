# Gym AI Tracker

Offline-first Progressive Web App (PWA) for tracking gym routines and sessions.

## Features
- **Offline First**: Works without internet using IndexedDB & Service Worker.
- **Auto Sync**: Syncs with server when online.
- **AI Routine Builder**: Create routines in seconds (Placeholder for now).
- **Session Logging**: Track sets, reps, weight, RPE.
- **Stats**: Weekly progress dashboard.

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Dexie.js (IndexedDB), Zustand, Recharts.
- **Backend**: FastAPI, SQLAlchemy, Alembic, PostgreSQL.
- **Infrastructure**: Docker Compose, Nginx.

## Getting Started

1. **Start the application**:
   ```bash
   make up
   # or
   docker-compose up -d --build
   ```

2. **Access the App**:
   Open [http://localhost:8080](http://localhost:8080) in your browser.

3. **Login/Register**:
   Create a new account.

4. **Seed Data**:
   Exercises have been seeded automatically (Check `backend/app/seed_data.py` if needed).

## Development

- **Frontend**: runs on port `5173` inside docker, proxied to `8080`.
- **Backend API**: runs on port `8000` inside docker, proxied to `8080/api`.
- **Database**: PostgreSQL on port `5432`.

## Commands
- `make logs`: View logs
- `make down`: Stop containers
- `make test`: Run tests
