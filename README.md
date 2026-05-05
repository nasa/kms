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
export bamboo_AWS_REGION=[for example us-east-1]
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
- If `bamboo_EBS_VOLUME_ID` is set, RDF4J will attach and use that existing restored `vol-...`, and the default CDK-managed RDF4J EBS stack will be skipped for that deploy.
- If `bamboo_EBS_VOLUME_ID` is not set, CDK will create a new blank RDF4J EBS volume.
- When `bamboo_EBS_VOLUME_ID` is set, `deploy-bamboo.sh` fails early unless both `bamboo_SUBNET_ID_B` and the restored volume are in `us-east-1a`.

#### Deploy KMS Application
```
./bin/deploy-bamboo.sh
```

### Recover a Deleted RDF4J EBS Volume
Use this flow when the RDF4J EBS volume has been deleted and you need to restore a replacement
`vol-...` and redeploy KMS against it.

1. Set your AWS restore context:
   ```bash
   export AWS_PROFILE=[your aws profile]
   export AWS_REGION=${bamboo_AWS_REGION:-us-east-1}
   # Reuse the original retained RDF4J backup vault to avoid name collisions on rebuilds
   export VAULT_NAME=rdf4j-backup-vault
   echo "Using Vault: $VAULT_NAME"
   export RESTORE_AZ=us-east-1a
   ```

2. List the available EBS recovery points in the backup vault:
   ```bash
   aws backup list-recovery-points-by-backup-vault \
     --backup-vault-name "$VAULT_NAME" \
     --by-resource-type EBS \
     --query 'sort_by(RecoveryPoints,&CreationDate)[].{Created:CreationDate,RecoveryPointArn:RecoveryPointArn,Status:Status,SourceVolumeArn:ResourceArn}' \
     --output table
   ```

3. Capture the latest recovery point ARN and extract the snapshot ID:
   ```bash
   RECOVERY_POINT_ARN=$(aws backup list-recovery-points-by-backup-vault \
     --backup-vault-name "$VAULT_NAME" \
     --by-resource-type EBS \
     --query 'sort_by(RecoveryPoints,&CreationDate)[-1].RecoveryPointArn' \
     --output text)

   SNAPSHOT_ID=$(echo "$RECOVERY_POINT_ARN" | awk -F'/' '{print $2}')

   echo "Recovery Point ARN: $RECOVERY_POINT_ARN"
   echo "Snapshot ID: $SNAPSHOT_ID"
   ```

4. Restore the snapshot directly to a new EBS volume in `us-east-1a`:
   ```bash
   VOLUME_ID=$(aws ec2 create-volume \
     --availability-zone "$RESTORE_AZ" \
     --snapshot-id "$SNAPSHOT_ID" \
     --volume-type gp3 \
     --region "$AWS_REGION" \
     --query 'VolumeId' \
     --output text)

   echo "New Volume ID: $VOLUME_ID"
   ```

5. Verify the new volume is available:
   ```bash
   aws ec2 describe-volumes \
     --volume-ids "$VOLUME_ID" \
     --region "$AWS_REGION" \
     --query 'Volumes[0].State' \
     --output text
   ```

6. Scale the RDF4J Auto Scaling Group down to `0` before deleting the stacks, so the running EC2 instance and ECS capacity do not block stack deletion:
   ```bash
   ./bin/scale_asg_down.sh
   ```

7. Delete `rdf4jEcsStack`, `rdf4jEbsStack`, and `rdf4jSnapshotStack` before redeploying, because they still reference the deleted original RDF4J volume:
   In the AWS CloudFormation console, in the correct region, delete `rdf4jEcsStack`, `rdf4jEbsStack`, and `rdf4jSnapshotStack`.
   CLI alternative using CDK `destroy --exclusively` so only these RDF4J stacks are removed:
   ```bash
   cd cdk
   npx aws-cdk@latest destroy --exclusively -f rdf4jEcsStack rdf4jEbsStack rdf4jSnapshotStack
   cd ..
   ```

8. Deploy via Bamboo with the updated `bamboo_EBS_VOLUME_ID` set to the restored volume id.

Notes:
- The EC2 `create-volume` command creates the new EBS volume immediately.
- `VOLUME_ID` is the restored `vol-...` identifier to pass in as `bamboo_EBS_VOLUME_ID`.
- `RESTORE_AZ` should stay aligned with the RDF4J subnet/AZ used by this deployment flow.
- `deploy-bamboo.sh` fails early unless both `bamboo_SUBNET_ID_B` and `bamboo_EBS_VOLUME_ID` are in `us-east-1a`.
### Troubleshooting: RDF4J 500 Errors After Restore

If the deployment succeeds but your API returns `500 Unable to get statements` or `SailException` errors, the AWS Backup snapshot likely captured the database in a "dirty" state (mid-transaction).

To fix this without losing data, you must clear the stale lock files left behind by the snapshot:

1. Connect to the running EC2 instance via AWS Systems Manager (Session Manager).
2. Run the following commands to safely remove the stale transaction logs and lock files:
   ```bash
   sudo find /mnt/rdf4j-data -name "lock" -type f -delete
   sudo find /mnt/rdf4j-data -name "extx" -type f -delete
   sudo find /mnt/rdf4j-data -name "*.txn" -type f -delete
   sudo find /mnt/rdf4j-data -name "write.lock" -type f -delete
   ```
3. Restart the Docker container so Tomcat/RDF4J cleanly rebuilds its indexes in memory:
   ```bash
   sudo docker restart $(sudo docker ps -q)
   ```
