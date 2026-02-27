#!/usr/bin/env bash

# Shared defaults for local SAM/CDK workflows.
export RDF4J_SERVICE_URL="${RDF4J_SERVICE_URL:-http://rdf4j-server:8080}"
export REDIS_ENABLED="${REDIS_ENABLED:-true}"
export REDIS_HOST="${REDIS_HOST:-kms-redis-local}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export KMS_DOCKER_NETWORK="${KMS_DOCKER_NETWORK:-kms-network}"
export SAM_WARM_CONTAINERS="${SAM_WARM_CONTAINERS:-EAGER}"
export SAM_LOCAL_WATCH="${SAM_LOCAL_WATCH:-false}"
