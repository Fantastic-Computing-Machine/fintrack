#!/bin/sh

set -eu

API_DIR="/opt/fintrack/api"
APP_DIR="/opt/fintrack/app"


echo "Running database migrations..."
cd "${API_DIR}"

alembic upgrade head

echo "Starting FastAPI..."
uvicorn fintrack.main:app \
    --host 0.0.0.0 \
    --port 8000 &

API_PID=$!


echo "Starting Next.js..."
cd "${APP_DIR}"
node server.js &

APP_PID=$!


shutdown() {
    echo "Stopping FinTrack..."

    kill -TERM "${API_PID}" "${APP_PID}" 2>/dev/null || true

    wait "${API_PID}" 2>/dev/null || true
    wait "${APP_PID}" 2>/dev/null || true
}

trap shutdown TERM INT

while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${APP_PID}" 2>/dev/null; do
    sleep 1
done

EXIT_CODE=0
if ! kill -0 "${API_PID}" 2>/dev/null; then
    wait "${API_PID}" || EXIT_CODE=$?
else
    wait "${APP_PID}" || EXIT_CODE=$?
fi

shutdown

exit "${EXIT_CODE}"
