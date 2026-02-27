#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

NETWORK_NAME="${RDF4J_DOCKER_NETWORK:-${KMS_DOCKER_NETWORK:-kms-network}}"
CONTAINER_NAME="${RDF4J_CONTAINER_NAME:-rdf4j-server}"
RDF4J_USER_NAME="${RDF4J_USER_NAME:-rdf4j}"
RDF4J_PASSWORD="${RDF4J_PASSWORD:-rdf4j}"
RDF4J_CONTAINER_MEMORY_LIMIT="${RDF4J_CONTAINER_MEMORY_LIMIT:-4096}"

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  docker network create "$NETWORK_NAME" >/dev/null
fi

if docker ps -aq --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

docker run \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -d \
  -p 8081:8080 \
  -e "RDF4J_USER_NAME=${RDF4J_USER_NAME}" \
  -e "RDF4J_PASSWORD=${RDF4J_PASSWORD}" \
  -e "RDF4J_CONTAINER_MEMORY_LIMIT=${RDF4J_CONTAINER_MEMORY_LIMIT}" \
  -v logs:/usr/local/tomcat/logs \
  rdf4j:latest
