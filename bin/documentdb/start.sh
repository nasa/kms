#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

IMAGE="${DOCUMENTDB_LOCAL_IMAGE:-mongo:8.0}"
CONTAINER_PORT="27017"
VOLUME_NAME="${DOCUMENTDB_LOCAL_VOLUME:-kms-documentdb-local-data}"

if ! docker network inspect "${KMS_DOCKER_NETWORK}" >/dev/null 2>&1; then
  docker network create "${KMS_DOCKER_NETWORK}" >/dev/null
  echo "Created docker network '${KMS_DOCKER_NETWORK}'"
fi

existing_id="$(docker ps -aq --filter "name=^${DOCUMENTDB_CONTAINER_NAME}$")"
if [[ -n "${existing_id}" ]]; then
  running_id="$(docker ps -q --filter "name=^${DOCUMENTDB_CONTAINER_NAME}$")"
  if [[ -n "${running_id}" ]]; then
    echo "Mongo container '${DOCUMENTDB_CONTAINER_NAME}' is already running"
  else
    docker start "${DOCUMENTDB_CONTAINER_NAME}" >/dev/null
    echo "Started existing Mongo container '${DOCUMENTDB_CONTAINER_NAME}'"
  fi
else
  docker run -d \
    --name "${DOCUMENTDB_CONTAINER_NAME}" \
    --network "${KMS_DOCKER_NETWORK}" \
    --network-alias "${DOCUMENTDB_CONTAINER_NAME}" \
    -p "${DOCUMENTDB_HOST_PORT}:${CONTAINER_PORT}" \
    -v "${VOLUME_NAME}:/data/db" \
    "${IMAGE}" >/dev/null

  echo "Started Mongo container '${DOCUMENTDB_CONTAINER_NAME}' on ${DOCUMENTDB_HOST_PORT}->${CONTAINER_PORT}"
fi

mongo_ready=false
for _ in {1..30}; do
  if docker exec "${DOCUMENTDB_CONTAINER_NAME}" \
    mongosh --quiet --eval 'db.runCommand({ ping: 1 }).ok' 2>/dev/null | grep -q '1'; then
    mongo_ready=true
    break
  fi

  sleep 1
done

if [[ "${mongo_ready}" != "true" ]]; then
  echo "Mongo container '${DOCUMENTDB_CONTAINER_NAME}' did not become ready" >&2
  exit 1
fi

(
  cd "${PROJECT_ROOT}"
  DOCUMENTDB_URI="mongodb://127.0.0.1:${DOCUMENTDB_HOST_PORT}/?directConnection=true" \
    ./node_modules/.bin/vite-node \
      --config vite.config.js \
      scripts/local/initialize_metadata_correction_audit.mjs
)

echo "Connect from host using mongodb://localhost:${DOCUMENTDB_HOST_PORT}"
echo "Connect from SAM using ${DOCUMENTDB_URI}"
