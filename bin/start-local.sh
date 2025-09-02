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

# Synthesize the CDK stack
cd cdk
cdk synth --context useLocalstack="true" --output ./cdk.out > /dev/null 2>&1

# Start SAM local
sam local start-api \
  --template-file ./cdk.out/KmsStack.template.json \
  --warm-containers LAZY \
  --port 3013 \
  --docker-network kms-network \
  --env-vars env.json

# Wait for the SAM process
wait $!

# Cleanup on exit
cleanup
