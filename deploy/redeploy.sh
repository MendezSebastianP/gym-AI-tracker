#!/bin/bash
set -e

# After git pull, exec with --post-pull so bash re-reads the updated file
# from the directory mount (/app), which always reflects the latest commit.
if [ "$1" = "--post-pull" ]; then
    echo "Restarting services..."
    # Use Docker REST API directly via wget — avoids docker CLI BuildKit init crash
    wget -qO /dev/null --post-data='' "http://dockerproxy:2375/containers/gym-ai-tracker-api-1/restart?t=30"
    wget -qO /dev/null --post-data='' "http://dockerproxy:2375/containers/gym-ai-tracker-frontend-1/restart?t=30"

    # Wait for API container to be ready
    echo "Waiting for API to be ready..."
    for i in $(seq 1 30); do
        STATUS=$(wget -qO- "http://dockerproxy:2375/containers/gym-ai-tracker-api-1/json" 2>/dev/null | grep -o '"Running":true' || true)
        [ -n "$STATUS" ] && break
        sleep 2
    done
    sleep 5  # Extra buffer for uvicorn startup

    # Helper: run a command inside the API container via Docker exec REST API
    run_in_api() {
        local CMD_JSON="$1"
        local LABEL="$2"
        echo "Running: $LABEL ..."
        EXEC_ID=$(wget -qO- --header='Content-Type: application/json' \
            --post-data="{\"Cmd\":$CMD_JSON,\"AttachStdout\":true,\"AttachStderr\":true}" \
            "http://dockerproxy:2375/containers/gym-ai-tracker-api-1/exec" 2>/dev/null \
            | grep -o '"Id":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$EXEC_ID" ]; then
            wget -qO- --header='Content-Type: application/json' \
                --post-data='{"Detach":false}' \
                "http://dockerproxy:2375/exec/$EXEC_ID/start" 2>/dev/null || echo "  WARNING: $LABEL failed"
            echo "  $LABEL done."
        else
            echo "  WARNING: Could not exec $LABEL"
        fi
    }

    run_in_api '["alembic","upgrade","head"]' "Migrations"
    run_in_api '["python","-m","app.seed_data"]' "Seed exercises"
    run_in_api '["python","-m","app.seed_demo"]' "Seed demo data"

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
