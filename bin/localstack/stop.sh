#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

container_id="$(docker ps -aq --filter "name=^${LOCALSTACK_CONTAINER_NAME}$")"
if [[ -z "${container_id}" ]]; then
  echo "LocalStack container '${LOCALSTACK_CONTAINER_NAME}' does not exist"
  exit 0
fi

running_id="$(docker ps -q --filter "name=^${LOCALSTACK_CONTAINER_NAME}$")"
if [[ -z "${running_id}" ]]; then
  echo "LocalStack container '${LOCALSTACK_CONTAINER_NAME}' is already stopped"
  exit 0
fi

docker stop "${LOCALSTACK_CONTAINER_NAME}" >/dev/null
echo "Stopped LocalStack container '${LOCALSTACK_CONTAINER_NAME}'"
