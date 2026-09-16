#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

container_id="$(docker ps -aq --filter "name=^${DOCUMENTDB_CONTAINER_NAME}$")"
if [[ -z "${container_id}" ]]; then
  echo "Mongo container '${DOCUMENTDB_CONTAINER_NAME}' does not exist"
  exit 0
fi

running_id="$(docker ps -q --filter "name=^${DOCUMENTDB_CONTAINER_NAME}$")"
if [[ -z "${running_id}" ]]; then
  echo "Mongo container '${DOCUMENTDB_CONTAINER_NAME}' is already stopped"
  exit 0
fi

docker stop "${DOCUMENTDB_CONTAINER_NAME}" >/dev/null
echo "Stopped Mongo container '${DOCUMENTDB_CONTAINER_NAME}'"
