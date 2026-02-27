#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${RDF4J_CONTAINER_NAME:-rdf4j-server}"

if ! docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Container '${CONTAINER_NAME}' is not running." >&2
  exit 1
fi

docker exec -it "$CONTAINER_NAME" /bin/bash
