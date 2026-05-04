# KMS 2.0

Keyword Management System (KMS) is a application for maintaining keywords (science keywords, platforms, instruments, data centers, locations, projects, services, resolution, etc.) in the earthdata/IDN system.

## Links

## Getting Started

### Requirements

- [Node](https://nodejs.org/) (check .nvmrc for correct version)
- [nvm](https://github.com/nvm-sh/nvm) is highly recommended

### Setup

To install the necessary components, run:

```
npm install
```

### Usage

### Running local server

Prerequisites:
- Docker
- aws-sam-cli (`brew install aws-sam-cli`)

To start local server, first make sure to start LocalStack:
```
npm run localstack:start
```

By default, `start-local` enables Redis with the local container settings from `bin/env/local_env.sh`, so the normal local startup path is:
```bash
npm run redis:start
npm run start-local
```

If you do not need Redis for your local test, start local with Redis disabled:
```bash
REDIS_ENABLED=false npm run start-local
```

To run local server with SAM watch mode enabled
```
npm run start-local:watch
```

### Why local uses SAM and LocalStack

Local development intentionally splits responsibilities between SAM and LocalStack:

- SAM runs the API Gateway and Lambda side of KMS locally.
- LocalStack emulates AWS-managed services that SAM does not model end-to-end for this repo, especially SNS and SQS.
- RDF4J and Redis remain separate local services because they are not AWS services.

We do not run the entire application stack inside LocalStack because the existing SAM flow is simpler for day-to-day Lambda/API development, while LocalStack is most useful here for the managed messaging pieces. For keyword event processing, `npm run start-local` also starts `scripts/localstack/run_bridge.sh`, which runs `scripts/localstack/bridge.js`.

This bridge exists because `sam local start-api` does not emulate EventBridge targets or SQS event source mappings the way AWS does in deployed environments.

For bridge implementation details and extension guidance, see `scripts/localstack/README.md`

### Optional: Enable Redis cache in local SAM/LocalStack

By default, local `start-local` does not provision Redis in CDK. You can still test Redis caching by running Redis in Docker.
Local defaults are centralized in `bin/env/local_env.sh`.

1. Ensure the docker network exists:
```
npm run rdf4j:create-network
```

2. Start Redis on the same docker network used by SAM:
```
npm run redis:start
```

3. (Optional) override defaults in `bin/env/local_env.sh` or per-command, for example:
```
REDIS_ENABLED=true REDIS_HOST=kms-redis-local REDIS_PORT=6379 npm run start-local
```

4. Start local API:
```
npm run start-local
```

5. Verify cache behavior (published reads only):
- `GET /concepts?version=published`
- `GET /concepts/concept_scheme/{scheme}?version=published`

6. Check Redis cache memory usage:
```
npm run redis:memory_used
```

### Redis node types and memory (ElastiCache)

Common burstable node types for Redis/Valkey:

| Node type | Memory (GiB) |
| --- | --- |
| `cache.t4g.micro` | `0.5` |
| `cache.t4g.small` | `1.37` |
| `cache.t4g.medium` | `3.09` |
| `cache.t3.micro` | `0.5` |
| `cache.t3.small` | `1.37` |
| `cache.t3.medium` | `3.09` |

For full and latest node-family capacities (m/r/t and region support), see:
https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/CacheNodes.SupportedTypes.html

To disable local Redis cache again:
```
REDIS_ENABLED=false npm run start-local
```

### Invoke cache-prime cron locally

Runs the same Lambda used by the scheduled EventBridge cache-prime target, locally via SAM.
The script re-synthesizes `cdk/cdk.out/KmsStack.template.json` each run so local Redis env settings are baked into the template.

```bash
npm run prime-cache:invoke-local
```

## Local Testing

To run the test suite, run:

```
npm run test
```
## Setting up the RDF Database for local development
In order to run KMS locally, you first need to setup a RDF database.
### Prerequisites
RDF4J local defaults are in `bin/env/local_env.sh`.
If needed, override per command (for example: `RDF4J_USER_NAME=... RDF4J_PASSWORD=... npm run rdf4j:setup`).
### Building and Running the RDF Database
#### Build the docker image
```
npm run rdf4j:build
```
#### Create a docker network
```
npm run rdf4j:create-network
```
#### Run the docker image
```
npm run rdf4j:start
```
#### Pull latest concepts RDF files from CMR
```
npm run rdf4j:pull
```
#### Setup and load data into the RDF database
```
npm run rdf4j:setup
```

### At any time, you can stop the RDF database by issuing:
```
npm run rdf4j:stop
```

# Deployments
## Deploying KMS Application to AWS
### Prerequisites
#### Copy your AWS credentials and set these up as env variables
```
export RELEASE_VERSION=[app release version]
export bamboo_STAGE_NAME=[sit|uat|prod]
export bamboo_AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
export bamboo_AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
export bamboo_AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN}
export bamboo_SUBNET_ID_A={subnet #1}
export bamboo_SUBNET_ID_B={subnet #2}
export bamboo_SUBNET_ID_C={subnet #3}
export bamboo_VPC_ID={your vpc id}
export bamboo_RDF4J_USER_NAME=[your rdfdb user name]
export bamboo_RDF4J_PASSWORD=[your rdfdb password]
export bamboo_EDL_HOST=[edl host name]
export bamboo_EDL_UID=[edl user id]
export bamboo_EDL_PASSWORD=[edl password]
export bamboo_CMR_BASE_URL=[cmr base url]
export bamboo_CORS_ORIGIN=[comma separated list of cors origins]
export bamboo_RDF4J_CONTAINER_MEMORY_LIMIT=[7168 for sit|uat, 14336 for prod]
export bamboo_RDF4J_INSTANCE_TYPE=["M5.LARGE" for sit|uat, "R5.LARGE" for prod]
export bamboo_EBS_VOLUME_ID=[optional existing restored vol-... id to attach directly]
export bamboo_RDF_BUCKET_NAME=[name of bucket for storing archived versions]
export bamboo_EXISTING_API_ID=[api id if deploying this into an existing api gateway]
export bamboo_ROOT_RESOURCE_ID=[see CDK_MIGRATION.md for how to determine]
export bamboo_LOG_LEVEL=[INFO|DEBUG|WARN|ERROR]
export bamboo_KMS_REDIS_ENABLED=[true|false]
export bamboo_KMS_REDIS_NODE_TYPE=[for example cache.t3.micro]
```
Notes:
- If you are not deploying into an existing API Gateway, set `bamboo_EXISTING_API_ID` and `bamboo_ROOT_RESOURCE_ID` to empty strings.
- If `bamboo_EBS_VOLUME_ID` is set, CDK will import and use that existing restored `vol-...`
  directly instead of creating a new volume.
- If `bamboo_EBS_VOLUME_ID` is not set, CDK will create a new blank RDF4J EBS volume.

#### Deploy KMS Application
```
./bin/deploy-bamboo.sh
```

### Restore RDF4J EBS Volume From AWS Backup

Use this flow when the RDF4J EBS volume has been deleted or needs to be recovered from the
`rdf4j-backup-vault`.

Set your AWS context first:

```bash
export AWS_PROFILE=[your aws profile]
export AWS_REGION=us-east-1
export VAULT_NAME=rdf4j-backup-vault
```

List the available EBS recovery points in the backup vault:

```bash
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name "$VAULT_NAME" \
  --by-resource-type EBS \
  --query 'sort_by(RecoveryPoints,&CreationDate)[].{Created:CreationDate,RecoveryPointArn:RecoveryPointArn,Status:Status,SourceVolumeArn:ResourceArn}' \
  --output table
```

Capture the latest recovery point ARN:

```bash
RECOVERY_POINT_ARN=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name "$VAULT_NAME" \
  --by-resource-type EBS \
  --query 'sort_by(RecoveryPoints,&CreationDate)[-1].RecoveryPointArn' \
  --output text)

echo "$RECOVERY_POINT_ARN"
```

Extract the snapshot ID from the ARN:

```bash
SNAPSHOT_ID=$(echo "$RECOVERY_POINT_ARN" | awk -F'/' '{print $2}')
echo "Snapshot ID: $SNAPSHOT_ID"
```

Restore the snapshot directly to a new EBS volume (bypassing AWS Backup IAM restrictions):

```bash
VOLUME_ID=$(aws ec2 create-volume \
  --availability-zone "us-east-1a" \
  --snapshot-id "$SNAPSHOT_ID" \
  --volume-type "gp3" \
  --query 'VolumeId' \
  --output text)

echo "New Volume ID: $VOLUME_ID"
```

Verify the volume is available:

```bash
aws ec2 describe-volumes \
  --volume-ids "$VOLUME_ID" \
  --query 'Volumes[0].State' \
  --output text
```

Notes:

- The EC2 `create-volume` command creates the new EBS volume instantly.
- `VOLUME_ID` is the new `vol-...` identifier for the restored volume.
- If you want CDK to attach the restored volume directly, provide that `vol-...` value to
  `bamboo_EBS_VOLUME_ID` before deploying.
