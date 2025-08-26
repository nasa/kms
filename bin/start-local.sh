#!/bin/bash

# Function to clean up processes and ports
cleanup() {
    echo "Cleaning up..."
    # Kill the SAM process if it's running
    if [ ! -z "$SAM_PID" ]; then
        kill $SAM_PID 2>/dev/null
    fi
    # Kill any process using port 3013
    lsof -ti:3013 | xargs kill -9 2>/dev/null
    exit 0
}

# Set up trap to call cleanup function on Ctrl+C
trap cleanup SIGINT

# Stop, start and setup RDF4J
echo "Starting RDF4J..."
export RDF4J_USER_NAME=rdf4j
export RDF4J_PASSWORD=rdf4j
npm run rdf4j:stop
npm run rdf4j:start
# Wait for rdf4j server to start
sleep 10
npm run rdf4j:setup

# Synthesize the CDK stack
cd cdk
cdk synth --context useLocalstack=true --output ./cdk.out > /dev/null 2>&1

# Check if port 3013 is already in use
if lsof -Pi :3013 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 3013 is already in use. Attempting to free it..."
    lsof -ti:3013 | xargs kill -9
    sleep 2
fi

# Start SAM local
sam local start-api \
  --template-file ./cdk.out/KmsStack.template.json \
  --warm-containers LAZY \
  --port 3013 \
  --docker-network host &

SAM_PID=$!

# Wait for SAM to start
sleep 5

# Wait for the SAM process
wait $SAM_PID
