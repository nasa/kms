#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/env/local_env.sh"

# Function to clean up processes and containers
cleanup() {
    echo "Cleaning up..."
    exit 0
}

# Set up trap to call cleanup function on Ctrl+C
trap cleanup SIGINT

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
  --docker-network "${KMS_DOCKER_NETWORK}" \
  "${SAM_WATCH_ARGS[@]}"

# Wait for the SAM process
wait $!

# Cleanup on exit
cleanup
