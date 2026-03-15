#!/bin/bash
set -e
echo "Deploy triggered at $(date)"
cd /app
export GIT_CONFIG_GLOBAL=/tmp/.gc
git config --global --add safe.directory /app
git fetch https://github.com/MendezSebastianP/gym-AI-tracker.git main
git reset --hard FETCH_HEAD
echo "Restarting services..."
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d api frontend
echo "Running migrations..."
docker compose exec -T api alembic upgrade head
echo "Deploy complete at $(date)"
