#!/bin/bash
# redeploy.sh — Called by the webhook listener when a push to main is detected
set -e

echo "=========================================="
echo "🚀 Deploy triggered at $(date)"
echo "=========================================="

cd /app

# Pull latest code
echo "📥 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

# Rebuild and restart services
echo "🔨 Rebuilding containers..."
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml build --no-cache api frontend

echo "♻️ Restarting services..."
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d api frontend

# Run database migrations
echo "📦 Running migrations..."
docker compose exec -T api alembic upgrade head

echo "=========================================="
echo "✅ Deploy complete at $(date)"
echo "=========================================="
