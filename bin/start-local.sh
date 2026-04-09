#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${SCRIPT_DIR}/env/local_env.sh"

LOCAL_BRIDGE_PID=""

# Function to clean up processes and containers
cleanup() {
    echo "Cleaning up..."

    if [ -n "${LOCAL_BRIDGE_PID}" ] && kill -0 "${LOCAL_BRIDGE_PID}" >/dev/null 2>&1; then
      kill "${LOCAL_BRIDGE_PID}" >/dev/null 2>&1 || true
      wait "${LOCAL_BRIDGE_PID}" 2>/dev/null || true
    fi

    exit 0
}

# Set up trap to call cleanup function on Ctrl+C
trap cleanup SIGINT

SAM_WATCH_ARGS=()
if [ "$SAM_LOCAL_WATCH" = "true" ]; then
  SAM_WATCH_ARGS+=(--beta-features --watch)
fi

"${PROJECT_ROOT}/scripts/localstack/run_bridge.sh" &
LOCAL_BRIDGE_PID=$!

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
