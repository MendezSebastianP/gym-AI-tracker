#!/bin/bash
set -e

# After git pull, this script execs itself with --post-pull so bash
# re-reads the file fresh (avoiding the stale-buffer problem).
if [ "$1" = "--post-pull" ]; then
    echo "Restarting services..."
    docker restart gym-ai-tracker-api-1 gym-ai-tracker-frontend-1
    echo "Deploy complete at $(date)"
    exit 0
fi

echo "Deploy triggered at $(date)"
cd /app
export GIT_CONFIG_GLOBAL=/tmp/.gc
git config --global --add safe.directory /app
git fetch https://github.com/MendezSebastianP/gym-AI-tracker.git main
git reset --hard FETCH_HEAD
exec /bin/bash /scripts/redeploy.sh --post-pull
