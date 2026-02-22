#!/usr/bin/env bash
set -euo pipefail

NETWORK_NAME="${RDF4J_DOCKER_NETWORK:-kms-network}"

if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  echo "Docker network '${NETWORK_NAME}' already exists"
  exit 0
fi

docker network create "$NETWORK_NAME"
