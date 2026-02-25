#!/bin/bash

# Function to clean up processes and containers
cleanup() {
    echo "Cleaning up..."
    exit 0
}

# Set up trap to call cleanup function on Ctrl+C
trap cleanup SIGINT

# Set environment variables for local development
export RDF4J_SERVICE_URL=http://rdf4j-server:8080
export REDIS_ENABLED="${REDIS_ENABLED:-true}"
export REDIS_HOST="${REDIS_HOST:-kms-redis-local}"
export REDIS_PORT="${REDIS_PORT:-6379}"
SAM_WARM_CONTAINERS=${SAM_WARM_CONTAINERS:-EAGER}
SAM_LOCAL_WATCH=${SAM_LOCAL_WATCH:-false}

SAM_WATCH_ARGS=()
if [ "$SAM_LOCAL_WATCH" = "true" ]; then
  SAM_WATCH_ARGS+=(--beta-features --watch)
fi

# Synthesize the CDK stack
cd cdk
cdk synth --context useLocalstack="true" --output ./cdk.out > /dev/null 2>&1

# Start SAM local
sam local start-api \
  --template-file ./cdk.out/KmsStack.template.json \
  --warm-containers "${SAM_WARM_CONTAINERS}" \
  --port 3013 \
  --docker-network kms-network \
  "${SAM_WATCH_ARGS[@]}"

# Wait for the SAM process
wait $!

# Cleanup on exit
cleanup
