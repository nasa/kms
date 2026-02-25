#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${REDIS_CONTAINER_NAME:-kms-redis-local}"
IMAGE="${REDIS_IMAGE:-redis:7-alpine}"
HOST_PORT="${REDIS_HOST_PORT:-6380}"
CONTAINER_PORT="${REDIS_CONTAINER_PORT:-6379}"
NETWORK_NAME="${REDIS_DOCKER_NETWORK:-kms-network}"

if ! docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
  docker network create "${NETWORK_NAME}" >/dev/null
  echo "Created docker network '${NETWORK_NAME}'"
fi

existing_id="$(docker ps -aq --filter "name=^${CONTAINER_NAME}$")"
if [[ -n "${existing_id}" ]]; then
  running_id="$(docker ps -q --filter "name=^${CONTAINER_NAME}$")"
  if [[ -n "${running_id}" ]]; then
    echo "Redis container '${CONTAINER_NAME}' is already running on ${HOST_PORT}->${CONTAINER_PORT}"
    exit 0
  fi

  docker start "${CONTAINER_NAME}" >/dev/null
  echo "Started existing Redis container '${CONTAINER_NAME}' on ${HOST_PORT}->${CONTAINER_PORT}"
  exit 0
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  --network "${NETWORK_NAME}" \
  --network-alias "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  "${IMAGE}" \
  --save "" \
  --appendonly no >/dev/null

echo "Started Redis container '${CONTAINER_NAME}' on ${HOST_PORT}->${CONTAINER_PORT}"
echo "Connect from host using redis://localhost:${HOST_PORT}"
echo "Connect from SAM/Lambda containers using redis://${CONTAINER_NAME}:${CONTAINER_PORT}"
