#!/bin/bash

# Bail on unset variables, errors and trace execution
set -eux

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: Required environment variable '$name' is not set." >&2
    exit 1
  fi
}

warn_if_not_referenced_in_cdk() {
  local name="$1"
  if ! rg -q "process\\.env\\.${name}\\b" cdk/bin cdk/app; then
    echo "WARN: '$name' is set but not referenced in CDK sources (cdk/bin, cdk/app)." >&2
  fi
}

# Deployment configuration/variables
####################################

required_env_vars=(
  RELEASE_VERSION
  bamboo_STAGE_NAME
  bamboo_EDL_HOST
  bamboo_EDL_UID
  bamboo_AWS_ACCESS_KEY_ID
  bamboo_AWS_SECRET_ACCESS_KEY
  bamboo_AWS_SESSION_TOKEN
  bamboo_SUBNET_ID_A
  bamboo_SUBNET_ID_B
  bamboo_SUBNET_ID_C
  bamboo_VPC_ID
  bamboo_RDF4J_USER_NAME
  bamboo_RDF4J_PASSWORD
  bamboo_EDL_PASSWORD
  bamboo_CMR_BASE_URL
  bamboo_CORS_ORIGIN
  bamboo_RDF4J_INSTANCE_TYPE
  bamboo_RDF4J_CONTAINER_MEMORY_LIMIT
  bamboo_RDF_BUCKET_NAME
  bamboo_EXISTING_API_ID
  bamboo_ROOT_RESOURCE_ID
  bamboo_LOG_LEVEL
  bamboo_KMS_REDIS_ENABLED
  bamboo_KMS_REDIS_NODE_TYPE
)

for var_name in "${required_env_vars[@]}"; do
  require_env "$var_name"
done

cdk_backed_vars=(
  STAGE_NAME
  VPC_ID
  RDF4J_USER_NAME
  RDF4J_PASSWORD
  EDL_PASSWORD
  CMR_BASE_URL
  CORS_ORIGIN
  RDF_BUCKET_NAME
  EXISTING_API_ID
  ROOT_RESOURCE_ID
  LOG_LEVEL
  KMS_REDIS_ENABLED
  KMS_REDIS_NODE_TYPE
)

for cdk_var in "${cdk_backed_vars[@]}"; do
  warn_if_not_referenced_in_cdk "$cdk_var"
done

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
.DS_Store
.git
.github
.serverless
.webpack
cypress
dist
node_modules
tmp
EOF

cat <<EOF > Dockerfile
FROM node:22
COPY . /build
WORKDIR /build
RUN npm ci
EOF

dockerTag=kms-$bamboo_STAGE_NAME
stageOpts="--stage $bamboo_STAGE_NAME "

docker build -t $dockerTag .

# Convenience function to invoke `docker run` with appropriate env vars instead of baking them into image
dockerRun() {
  docker run \
        --rm \
        --env "AWS_ACCESS_KEY_ID=$bamboo_AWS_ACCESS_KEY_ID" \
        --env "AWS_SECRET_ACCESS_KEY=$bamboo_AWS_SECRET_ACCESS_KEY" \
        --env "AWS_SESSION_TOKEN=$bamboo_AWS_SESSION_TOKEN" \
        --env "STAGE_NAME=$bamboo_STAGE_NAME" \
        --env "NODE_ENV=$bamboo_STAGE_NAME" \
        --env "NODE_OPTIONS=--max_old_space_size=4096" \
        --env "SUBNET_ID_A=$bamboo_SUBNET_ID_A" \
        --env "SUBNET_ID_B=$bamboo_SUBNET_ID_B" \
        --env "SUBNET_ID_C=$bamboo_SUBNET_ID_C" \
        --env "VPC_ID=$bamboo_VPC_ID" \
        --env "RDF4J_USER_NAME=$bamboo_RDF4J_USER_NAME" \
        --env "RDF4J_PASSWORD=$bamboo_RDF4J_PASSWORD" \
        --env "EDL_PASSWORD=$bamboo_EDL_PASSWORD" \
        --env "CMR_BASE_URL=$bamboo_CMR_BASE_URL" \
        --env "CORS_ORIGIN=$bamboo_CORS_ORIGIN" \
        --env "RDF4J_INSTANCE_TYPE=$bamboo_RDF4J_INSTANCE_TYPE" \
        --env "RDF4J_CONTAINER_MEMORY_LIMIT=$bamboo_RDF4J_CONTAINER_MEMORY_LIMIT" \
        --env "RDF_BUCKET_NAME=$bamboo_RDF_BUCKET_NAME" \
        --env "EXISTING_API_ID=$bamboo_EXISTING_API_ID" \
        --env "ROOT_RESOURCE_ID=$bamboo_ROOT_RESOURCE_ID" \
        --env "LOG_LEVEL=$bamboo_LOG_LEVEL" \
        --env "KMS_REDIS_ENABLED=$bamboo_KMS_REDIS_ENABLED" \
        --env "KMS_REDIS_NODE_TYPE=$bamboo_KMS_REDIS_NODE_TYPE" \
    $dockerTag "$@"
}

# Execute deployment commands in Docker
#######################################

# Deploy to AWS
echo 'Deploying to AWS Resources...'
dockerRun npm run deploy-application
