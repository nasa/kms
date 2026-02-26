#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/../env/local_env.sh"

RDF4J_CONTAINER_NAME="${RDF4J_CONTAINER_NAME:-rdf4j-server}"
RDF4J_USER_NAME="${RDF4J_USER_NAME:-rdf4j}"
RDF4J_PASSWORD="${RDF4J_PASSWORD:-rdf4j}"
RDF4J_REPOSITORY_ID="${RDF4J_REPOSITORY_ID:-kms}"
# Setup runs from host machine against mapped port by default.
export RDF4J_SERVICE_URL="${RDF4J_SETUP_SERVICE_URL:-http://127.0.0.1:8081}"
export RDF4J_CONTAINER_NAME RDF4J_USER_NAME RDF4J_PASSWORD RDF4J_REPOSITORY_ID

echo "Running RDF4J setup against ${RDF4J_SERVICE_URL}/rdf4j-server (repo=${RDF4J_REPOSITORY_ID})"

node setup/setupRdf4j.js
