#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

REQUIRED_SERVICES="sns,sqs,events"

if ! docker network inspect "${KMS_DOCKER_NETWORK}" >/dev/null 2>&1; then
  docker network create "${KMS_DOCKER_NETWORK}" >/dev/null
  echo "Created docker network '${KMS_DOCKER_NETWORK}'"
fi

existing_id="$(docker ps -aq --filter "name=^${LOCALSTACK_CONTAINER_NAME}$")"
if [[ -n "${existing_id}" ]]; then
  configured_services="$(
    docker inspect \
      --format '{{range .Config.Env}}{{println .}}{{end}}' \
      "${LOCALSTACK_CONTAINER_NAME}" \
      | grep '^SERVICES=' \
      | cut -d= -f2- \
      || true
  )"

  if [[ ",${configured_services}," != *",events,"* ]]; then
    docker rm -f "${LOCALSTACK_CONTAINER_NAME}" >/dev/null
    echo "Recreating LocalStack container '${LOCALSTACK_CONTAINER_NAME}' to enable services: ${REQUIRED_SERVICES}"
    existing_id=""
  fi
fi

if [[ -n "${existing_id}" ]]; then
  running_id="$(docker ps -q --filter "name=^${LOCALSTACK_CONTAINER_NAME}$")"
  if [[ -n "${running_id}" ]]; then
    echo "LocalStack container '${LOCALSTACK_CONTAINER_NAME}' is already running on ${LOCALSTACK_PORT}->4566"
    exit 0
  fi

  docker start "${LOCALSTACK_CONTAINER_NAME}" >/dev/null
  echo "Started existing LocalStack container '${LOCALSTACK_CONTAINER_NAME}' on ${LOCALSTACK_PORT}->4566"
  exit 0
fi

docker run -d \
  --name "${LOCALSTACK_CONTAINER_NAME}" \
  --network "${KMS_DOCKER_NETWORK}" \
  --network-alias "localstack" \
  -p "${LOCALSTACK_PORT}:4566" \
  -e SERVICES="${REQUIRED_SERVICES}" \
  -e AWS_DEFAULT_REGION="us-east-1" \
  -e EDGE_PORT="4566" \
  "${LOCALSTACK_IMAGE}" >/dev/null

echo "Started LocalStack container '${LOCALSTACK_CONTAINER_NAME}' on ${LOCALSTACK_PORT}->4566"
echo "SNS/SQS/EventBridge endpoint for SAM/Lambda containers: ${AWS_ENDPOINT_URL}"
echo "SNS/SQS/EventBridge endpoint from host: http://localhost:${LOCALSTACK_PORT}"
