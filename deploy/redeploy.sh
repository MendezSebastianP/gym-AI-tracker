#!/bin/bash
set -e

# After git pull, exec with --post-pull so bash re-reads the updated file
# from the directory mount (/app), which always reflects the latest commit.
if [ "$1" = "--post-pull" ]; then
    echo "Restarting services..."
    # Use Docker REST API directly via wget — avoids docker CLI BuildKit init crash
    wget -qO /dev/null --post-data='' "http://dockerproxy:2375/containers/gym-ai-tracker-api-1/restart?t=30"
    wget -qO /dev/null --post-data='' "http://dockerproxy:2375/containers/gym-ai-tracker-frontend-1/restart?t=30"
    echo "Deploy complete at $(date)"
    exit 0
fi

echo "Deploy triggered at $(date)"
cd /app
export GIT_CONFIG_GLOBAL=/tmp/.gc
git config --global --add safe.directory /app
git fetch https://github.com/MendezSebastianP/gym-AI-tracker.git main
git reset --hard FETCH_HEAD
exec /bin/bash /app/deploy/redeploy.sh --post-pull
