#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${REDIS_CONTAINER_NAME:-kms-redis-local}"
HOST="${REDIS_CONNECT_HOST:-127.0.0.1}"
PORT="${REDIS_HOST_PORT:-6380}"

if command -v redis-cli >/dev/null 2>&1; then
  echo "Connecting via host redis-cli to redis://${HOST}:${PORT}"
  exec redis-cli -h "${HOST}" -p "${PORT}"
fi

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "Host redis-cli not found; connecting via docker exec to '${CONTAINER_NAME}'"
  exec docker exec -it "${CONTAINER_NAME}" redis-cli
fi

echo "Could not connect to Redis."
echo "Start Redis first with: npm run redis:start"
echo "If using host redis-cli, install it or ensure '${CONTAINER_NAME}' is running for docker fallback."
exit 1
