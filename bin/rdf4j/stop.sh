#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${RDF4J_CONTAINER_NAME:-rdf4j-server}"

if docker ps -q --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Stopping container '${CONTAINER_NAME}'..."
  docker kill "$CONTAINER_NAME" >/dev/null
  echo "Stopped container '${CONTAINER_NAME}'."
else
  echo "Container '${CONTAINER_NAME}' is not running."
fi

if docker ps -aq --filter "name=^${CONTAINER_NAME}$" | grep -q .; then
  echo "Removing container '${CONTAINER_NAME}'..."
  docker rm "$CONTAINER_NAME" >/dev/null
  echo "Removed container '${CONTAINER_NAME}'."
else
  echo "Container '${CONTAINER_NAME}' does not exist."
fi
