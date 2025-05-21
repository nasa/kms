#!/bin/bash

# Bail on unset variables, errors and trace execution
set -eux

# Deployment configuration/variables
####################################

# read in static.config.json
config="`cat static.config.json`"

# update keys for deployment
config="`jq '.application.version = $newValue' --arg newValue ${RELEASE_VERSION} <<< $config`"
config="`jq '.application.env = $newValue' --arg newValue $bamboo_STAGE_NAME <<< $config`"
config="`jq '.edl.host = $newValue' --arg newValue $bamboo_EDL_HOST <<< $config`"
config="`jq '.edl.uid = $newValue' --arg newValue $bamboo_EDL_UID <<< $config`"

# overwrite static.config.json with new values
echo $config > tmp.$$.json && mv tmp.$$.json static.config.json

# Set up Docker image
#####################

cat <<EOF > .dockerignore
node_modules
.DS_Store
.git
.github
.serverless
cmr
coverage
dist
node_modules
tmp
EOF

cat <<EOF > Dockerfile
FROM node:18-bullseye
COPY . /build
WORKDIR /build
RUN npm ci --omit=dev && npm run build
EOF
dockerTag=kms-$bamboo_STAGE_NAME
docker build -t $dockerTag .

# Convenience function to invoke `docker run` with appropriate env vars instead of baking them into image
dockerRun() {
    docker run \
        --env "AWS_ACCESS_KEY_ID=$bamboo_AWS_ACCESS_KEY_ID" \
        --env "AWS_SECRET_ACCESS_KEY=$bamboo_AWS_SECRET_ACCESS_KEY" \
        --env "AWS_SESSION_TOKEN=$bamboo_AWS_SESSION_TOKEN" \
        --env "LAMBDA_TIMEOUT=$bamboo_LAMBDA_TIMEOUT" \
        --env "NODE_ENV=$bamboo_STAGE_NAME" \
        --env "NODE_OPTIONS=--max_old_space_size=4096" \
        --env "SUBNET_ID_A=$bamboo_SUBNET_ID_A" \
        --env "SUBNET_ID_B=$bamboo_SUBNET_ID_B" \
        --env "SUBNET_ID_C=$bamboo_SUBNET_ID_C" \
        --env "VPC_ID=$bamboo_VPC_ID" \
        --env "RDF4J_USER_NAME=$bamboo_RDF4J_USER_NAME" \
        --env "RDF4J_PASSWORD=$bamboo_RDF4J_PASSWORD" \
        --env "EDL_PASSWORD=$bamboo_EDL_PASSWORD" \
        --env "SHOULD_SYNC=$bamboo_SHOULD_SYNC" \
        --env "SYNC_API_ENDPOINT=$bamboo_SYNC_API_ENDPOINT" \
        --env "CMR_BASE_URL=$bamboo_CMR_BASE_URL" \
        --env "CORS_ORIGIN=$bamboo_CORS_ORIGIN" \
        $dockerTag "$@"
}

# Execute serverless commands in Docker
#######################################

stageOpts="--stage $bamboo_STAGE_NAME"

# Deploy AWS Infrastructure Resources
echo 'Deploying AWS Infrastructure Resources...'
dockerRun npx serverless deploy $stageOpts --config serverless-infrastructure.yml

# Deploy AWS Application Resources
echo 'Deploying AWS Application Resources...'
dockerRun npx serverless deploy $stageOpts
