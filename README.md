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
export bamboo_RDF4J_BACKUP_VAULT_NAME=[optional existing vault name to import]
export bamboo_RDF_BUCKET_NAME=[name of bucket for storing archived versions]
export bamboo_EXISTING_API_ID=[api id if deploying this into an existing api gateway]
export bamboo_ROOT_RESOURCE_ID=[see CDK_MIGRATION.md for how to determine]
export bamboo_LOG_LEVEL=[INFO|DEBUG|WARN|ERROR]
export bamboo_KMS_REDIS_ENABLED=[true|false]
export bamboo_KMS_REDIS_NODE_TYPE=[for example cache.t3.micro]
```
Notes:
- If you are not deploying into an existing API Gateway, set `bamboo_EXISTING_API_ID` and `bamboo_ROOT_RESOURCE_ID` to empty strings.
- If `bamboo_RDF4J_BACKUP_VAULT_NAME` is set, `SnapshotStack` imports that existing backup vault. This is useful when `rdf4jSnapshotStack` is being recreated after an RDF4J recovery event and you need the new stack to reuse an existing vault instead of trying to create the same vault name again.
- If `bamboo_RDF4J_BACKUP_VAULT_NAME` is not set, `SnapshotStack` creates the default `rdf4j-backup-vault`.

#### Deploy KMS Application
```
./bin/deploy-bamboo.sh
```

### Recover a Deleted RDF4J EBS Volume

Use this flow when the RDF4J EBS volume has been deleted and you want to bring KMS/RDF4J back up
with a new empty CDK-managed volume.

1. Scale the RDF4J Auto Scaling Group down to `0` before deleting the stacks, so the running EC2 instance and ECS capacity do not block stack deletion:

   ```bash
   ./bin/scale_asg_down.sh
   ```

2. Delete the CloudFormation stacks (`rdf4jEcsStack`, `rdf4jEbsStack`, `rdf4jSnapshotStack`) via the AWS Console.
   CloudFormation often struggles to cleanly delete complex ECS clusters, Auto Scaling Groups, and Capacity Providers. If the stack deletion hangs or fails, manually remove the blocking resources in the AWS Console first:
   - **ECS Service & Tasks**: Go to ECS -> Clusters -> `rdf4jEcs`. Stop any running tasks. Under the Services tab, set the `rdf4jService` desired tasks to `0` and delete the service.
   - **Auto Scaling Group**: Go to EC2 -> Auto Scaling Groups. Find `rdf4jAutoScalingGroup`, set all capacities (Min/Max/Desired) to `0`, and delete it.
   - **Capacity Provider**: If CloudFormation throws a `ResourceInUseException`, you may need to manually delete the capacity provider from the ECS cluster.
   - **ECS Cluster**: Once the service and capacity providers are removed, you may also need to manually delete the `rdf4jEcs` cluster itself.
   - **Force Delete**: Go back to CloudFormation and click **Delete** on the failed stack again. A prompt will appear allowing you to "Retain" the failed resources. Check the boxes for the stubborn resources and click Delete to successfully clear the stack state.

3. Redeploy via Bamboo. CDK will recreate `rdf4jEbsStack` with a new blank RDF4J volume and bring
   RDF4J back up with an empty database.

### Restore Old RDF4J Data Later

AWS does not restore an EBS snapshot into an existing volume in place. The supported AWS flow is:

- restore the snapshot to a new EBS volume
- then either attach that restored volume separately and copy the data you need, or manually replace the current volume out of band

If you need to create that restored volume later, use this flow:

1. Set your AWS restore context and find where your current RDF4J instance is running:

   ```bash
   export AWS_PROFILE=[your aws profile]
   export AWS_REGION=${AWS_REGION:-us-east-1}
   export VAULT_NAME=${bamboo_RDF4J_BACKUP_VAULT_NAME:-rdf4j-backup-vault}

   # Dynamically find the running instance ID and its Availability Zone
   export INSTANCE_ID=$(aws ec2 describe-instances --region "$AWS_REGION" --filters "Name=tag:aws:autoscaling:groupName,Values=*rdf4jAutoScalingGroup*" "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].InstanceId' --output text)
   export RESTORE_AZ=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" --query 'Reservations[*].Instances[*].Placement.AvailabilityZone' --output text)

   echo "Target Instance: $INSTANCE_ID in Zone: $RESTORE_AZ"
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

4. Restore the snapshot to a new EBS volume in `$RESTORE_AZ`:

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

5. Verify the restored volume is available:

   ```bash
   aws ec2 describe-volumes \
     --volume-ids "$VOLUME_ID" \
     --region "$AWS_REGION" \
     --query 'Volumes[0].State' \
     --output text
   ```

6. To copy the restored data into the current CDK-managed RDF4J volume using Session Manager:
   1. Attach the restored volume to the running RDF4J EC2 instance from your local shell:

      ```bash
      export INSTANCE_ID=[running rdf4j ec2 instance id]

      aws ec2 attach-volume \
        --volume-id "$VOLUME_ID" \
        --instance-id "$INSTANCE_ID" \
        --device /dev/sdg \
        --region "$AWS_REGION"
      ```

   2. Connect to the instance with AWS Systems Manager Session Manager.

   3. On the instance, identify the restored device and mount it read-only at a temporary path.
      On Nitro instances, the volume may appear as `/dev/nvme...` instead of `/dev/sdg`, so use
      `lsblk -f` to find the unmounted filesystem device first:

      ```bash
      lsblk -f

      sudo mkdir -p /mnt/rdf4j-restore
      sudo mount -o ro [restored-device-from-lsblk] /mnt/rdf4j-restore
      ```

   4. Stop the running RDF4J container before copying data into `/mnt/rdf4j-data`:

      ```bash
      sudo docker ps -q | xargs -r sudo docker stop
      ```

   5. Install `rsync` if missing, then copy the restored data into the current CDK-managed RDF4J volume:

      ```bash
      sudo yum install -y rsync
      sudo rsync -aHAX --delete /mnt/rdf4j-restore/ /mnt/rdf4j-data/
      sudo chown -R 1000:1000 /mnt/rdf4j-data
      ```

   6. Remove stale lock and transaction files that may have been captured in the snapshot:

      ```bash
      sudo find /mnt/rdf4j-data -name "lock" -type f -delete
      sudo find /mnt/rdf4j-data -name "extx" -type f -delete
      sudo find /mnt/rdf4j-data -name "*.txn" -type f -delete
      sudo find /mnt/rdf4j-data -name "write.lock" -type f -delete
      ```

   7. Unmount the temporary restored volume and restart the EC2 instance to cleanly rebuild the ECS networking containers:

      ```bash
      sudo umount /mnt/rdf4j-restore
      sudo reboot
      ```

      _(Note: It may take 3-5 minutes for the instance to reboot and the API to become healthy. If the API consistently returns `Failed to fetch RDF4J status`, go to the AWS ECS Console -> select your service -> click **Update** -> check **Force new deployment** to force ECS to cycle the task)._

   8. Optional verification:

      ```bash
      mount | grep rdf4j
      sudo docker ps
      sudo docker logs --tail 100 $(sudo docker ps -q)
      ```

   9. Clean up the temporary restored volume from your local shell:
      ```bash
      aws ec2 detach-volume --volume-id "$VOLUME_ID"
      sleep 10
      aws ec2 delete-volume --volume-id "$VOLUME_ID"
      ```

7. Alternative: manually replace the current volume out of band using AWS’s documented snapshot
   replacement flow.

AWS references:

- `https://docs.aws.amazon.com/aws-backup/latest/devguide/restoring-ebs.html`
- `https://docs.aws.amazon.com/ebs/latest/userguide/ebs-restoring-volume.html`

### Troubleshooting: RDF4J 500 Errors After Restoring Snapshot Data

If you manually restore snapshot data and your API returns `500 Unable to get statements` or
`SailException` errors, the AWS Backup snapshot likely captured the database in a "dirty" state
(mid-transaction).

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
