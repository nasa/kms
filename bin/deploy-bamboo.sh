#!/bin/bash

# Bail on unset variables, errors and trace execution
set -eux

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
export bamboo_STAGE_NAME=sit
dockerTag=kms-$bamboo_STAGE_NAME
docker build -t $dockerTag .

# Convenience function to invoke `docker run` with appropriate env vars instead of baking them into image
dockerRun() {
    docker run \
        -e "AWS_ACCESS_KEY_ID=$bamboo_AWS_ACCESS_KEY_ID" \
        -e "AWS_SECRET_ACCESS_KEY=$bamboo_AWS_SECRET_ACCESS_KEY" \
        -e "AWS_SESSION_TOKEN=$bamboo_AWS_SESSION_TOKEN" \
        -e "LAMBDA_TIMEOUT=$bamboo_LAMBDA_TIMEOUT" \
        -e "NODE_ENV=sit" \
        -e "NODE_OPTIONS=--max_old_space_size=4096" \
        -e "SUBNET_ID_A=$bamboo_SUBNET_ID_A" \
        -e "SUBNET_ID_B=$bamboo_SUBNET_ID_B" \
        -e "SUBNET_ID_C=$bamboo_SUBNET_ID_C" \
        -e "VPC_ID=$bamboo_VPC_ID" \
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

# Deploy static assets
echo 'Deploying static assets to S3...'
#dockerRun npx serverless client deploy $stageOpts --no-confirm
