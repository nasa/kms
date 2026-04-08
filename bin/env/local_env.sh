#!/usr/bin/env bash

# Shared defaults for local SAM/CDK workflows.
export RDF4J_SERVICE_URL="${RDF4J_SERVICE_URL:-http://rdf4j-server:8080}"
export REDIS_ENABLED="${REDIS_ENABLED:-true}"
export REDIS_HOST="${REDIS_HOST:-kms-redis-local}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export KMS_DOCKER_NETWORK="${KMS_DOCKER_NETWORK:-kms-network}"
export LOCALSTACK_CONTAINER_NAME="${LOCALSTACK_CONTAINER_NAME:-kms-localstack}"
export LOCALSTACK_IMAGE="${LOCALSTACK_IMAGE:-localstack/localstack:3.8.1}"
export LOCALSTACK_PORT="${LOCALSTACK_PORT:-4566}"
export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localstack:${LOCALSTACK_PORT}}"
export SAM_WARM_CONTAINERS="${SAM_WARM_CONTAINERS:-EAGER}"
export SAM_LOCAL_WATCH="${SAM_LOCAL_WATCH:-false}"
