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
deploymentRegion="${bamboo_AWS_REGION:-us-east-1}"
rdf4jRestoreAz="us-east-1a"

docker build -t $dockerTag .

# Convenience function to invoke `docker run` with appropriate env vars instead of baking them into image
dockerRun() {
  docker run \
        --rm \
        --env "AWS_ACCESS_KEY_ID=$bamboo_AWS_ACCESS_KEY_ID" \
        --env "AWS_SECRET_ACCESS_KEY=$bamboo_AWS_SECRET_ACCESS_KEY" \
        --env "AWS_SESSION_TOKEN=$bamboo_AWS_SESSION_TOKEN" \
        --env "AWS_REGION=$deploymentRegion" \
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
        --env "BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE=${bamboo_BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE:-false}" \
        --env "KEYWORD_SYNC_ALARM_EMAILS=${bamboo_KEYWORD_SYNC_ALARM_EMAILS:-}" \
        --env "CORS_ORIGIN=$bamboo_CORS_ORIGIN" \
        --env "RDF4J_INSTANCE_TYPE=$bamboo_RDF4J_INSTANCE_TYPE" \
        --env "RDF4J_CONTAINER_MEMORY_LIMIT=$bamboo_RDF4J_CONTAINER_MEMORY_LIMIT" \
        --env "EBS_VOLUME_ID=${bamboo_EBS_VOLUME_ID:-}" \
        --env "RDF_BUCKET_NAME=$bamboo_RDF_BUCKET_NAME" \
        --env "EXISTING_API_ID=$bamboo_EXISTING_API_ID" \
        --env "ROOT_RESOURCE_ID=$bamboo_ROOT_RESOURCE_ID" \
        --env "LOG_LEVEL=$bamboo_LOG_LEVEL" \
        --env "KMS_REDIS_ENABLED=$bamboo_KMS_REDIS_ENABLED" \
        --env "KMS_REDIS_NODE_TYPE=$bamboo_KMS_REDIS_NODE_TYPE" \
        --env "LOG_DESTINATION_ARN=$bamboo_LOG_DESTINATION_ARN" \
    $dockerTag "$@"
}

awsWithBambooCreds() {
  AWS_ACCESS_KEY_ID="$bamboo_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$bamboo_AWS_SECRET_ACCESS_KEY" AWS_SESSION_TOKEN="$bamboo_AWS_SESSION_TOKEN" \
    aws --region "$deploymentRegion" "$@"
}

# Execute deployment commands in Docker
#######################################

# When reusing a restored RDF4J volume, fail early unless both SUBNET_ID_B and the
# restored volume are in the RDF4J restore AZ.
if [[ -n "${bamboo_EBS_VOLUME_ID:-}" ]]; then
  subnetAz=$(awsWithBambooCreds ec2 describe-subnets \
    --subnet-ids "$bamboo_SUBNET_ID_B" \
    --query 'Subnets[0].AvailabilityZone' \
    --output text)

  volumeAz=$(awsWithBambooCreds ec2 describe-volumes \
    --volume-ids "$bamboo_EBS_VOLUME_ID" \
    --query 'Volumes[0].AvailabilityZone' \
    --output text)

  if [[ "$subnetAz" != "$rdf4jRestoreAz" ]]; then
    echo "Refusing deploy: SUBNET_ID_B ($bamboo_SUBNET_ID_B) must be in $rdf4jRestoreAz but is in $subnetAz."
    exit 1
  fi

  if [[ "$volumeAz" != "$rdf4jRestoreAz" ]]; then
    echo "Refusing deploy: EBS_VOLUME_ID ($bamboo_EBS_VOLUME_ID) must be in $rdf4jRestoreAz but is in $volumeAz."
    exit 1
  fi
fi

# Deploy to AWS
echo 'Deploying to AWS Resources...'
dockerRun npm run deploy-application
