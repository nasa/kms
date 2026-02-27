#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${REDIS_CONTAINER_NAME:-kms-redis-local}"

container_id="$(docker ps -aq --filter "name=^${CONTAINER_NAME}$")"
if [[ -z "${container_id}" ]]; then
  echo "Redis container '${CONTAINER_NAME}' does not exist"
  exit 0
fi

running_id="$(docker ps -q --filter "name=^${CONTAINER_NAME}$")"
if [[ -z "${running_id}" ]]; then
  echo "Redis container '${CONTAINER_NAME}' is already stopped"
  exit 0
fi

docker stop "${CONTAINER_NAME}" >/dev/null
echo "Stopped Redis container '${CONTAINER_NAME}'"
