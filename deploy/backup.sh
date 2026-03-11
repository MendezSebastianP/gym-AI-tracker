#!/bin/bash
# Local backup script for Gym AI Tracker database
# Executed via cron on the host machine to backup the postgres container.

BACKUP_DIR="/home/trota/Documents/gym-AI-tracker/backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/gym_tracker_backup_$DATE.sql.gz"

echo "Starting backup of gym_tracker database..."
cd /home/trota/Documents/gym-AI-tracker

# Run pg_dump inside the container and compress it
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml exec -T postgres pg_dump -U postgres -d gym_tracker -F c | gzip > "$FILE"

# Retain only the last 7 daily backups (delete older ones)
ls -tp "$BACKUP_DIR"/*.sql.gz | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {}

echo "Backup saved to $FILE"
echo "Retained last 7 backups. Done."
