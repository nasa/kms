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

### Redis cache namespaces and lifecycle

KMS uses Redis for two different jobs:

- published API response caching
- metadata-correction keyword lookups

Most Redis values are stored as serialized Lambda-style HTTP responses, not raw objects. A typical
cached value looks like:

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"uuid\":\"...\",\"fullPath\":\"...\"}"
}
```

For API response caches, `body` may instead be RDF/XML, JSON, XML, or CSV depending on the route.

#### Key families

##### Published API response caching

| Key family | Example key | Purpose | Typical body shape | Written by | Cleared when |
| --- | --- | --- | --- | --- | --- |
| `kms:concept:<version>:...` | `kms:concept:published:/concept/id/{conceptid}:/concept/id/123:rdf:123::::` | Published `/concept` response cache | Full Lambda response for one concept | `getConcept` | Cleared by `primeConceptsCache` when the published version marker changes |
| `kms:concepts:<version>:...` | `kms:concepts:published:/concepts:/concepts:::1:2000:json` | Published `/concepts` list/search response cache | Full Lambda response for one concepts/list request | `getConcepts` | Cleared by `primeConceptsCache` when the published version marker changes |
| `kms:tree:<version>:...` | `kms:tree:published:instruments:` | Published `/tree` response cache | Full Lambda response for one tree request | `getKeywordsTree` | Cleared by `primeConceptsCache` when the published version marker changes |
| `kms:concepts:published:version` | `kms:concepts:published:version` | Version marker used to decide whether published response caches need rewarming | Plain string: `<versionName>|<publishDate>` | `primeConceptsCache` | Rewritten on each successful cache-prime run; also falls under the `kms:concepts:*` clear sweep |

##### Metadata correction

| Key family | Example key | Purpose | Typical body shape | Written by | Cleared when |
| --- | --- | --- | --- | --- | --- |
| `kms:<scheme>:historical_concept:full_path:<encoded>` | `kms:sciencekeywords:historical_concept:full_path:earth%20science%20%3E%20atmosphere%20%3E%20aerosols` | Historical lookup for path-based schemes during metadata correction | `{"uuid","fullPath"}` wrapped in a cached HTTP response | `buildHistoricalConceptCache` | Not cleared during normal publish; updated only when a new historical version is processed |
| `kms:<scheme>:historical_concept:short_name:<encoded>` | `kms:platforms:historical_concept:short_name:aqua` | Historical lookup for short-name schemes during metadata correction | `{"uuid","fullPath","longName?"}` wrapped in a cached HTTP response | `buildHistoricalConceptCache` | Not cleared during normal publish; updated only when a new historical version is processed |
| `kms:historical_concept:versions:built:v1` | `kms:historical_concept:versions:built:v1` | Redis set of immutable historical version directories already processed from S3 | Redis set members like `3.19.22` | `buildHistoricalConceptCache` | Not cleared during normal publish; clear manually or bump the marker version in code to force a rebuild |
| `kms:<scheme>:published_concept:full_path:<encoded>` | `kms:sciencekeywords:published_concept:full_path:earth%20science%20%3E%20atmosphere%20%3E%20aerosols` | Current published validity lookup for path-based schemes | `{"uuid","fullPath"}` wrapped in a cached HTTP response | `primePublishedConceptCacheFromCsv` | Cleared per scheme immediately before that scheme is rewritten |
| `kms:<scheme>:published_concept:short_name:<encoded>` | `kms:platforms:published_concept:short_name:aqua` | Current published validity lookup for short-name schemes | `{"uuid","fullPath","longName?"}` wrapped in a cached HTTP response | `primePublishedConceptCacheFromCsv` | Cleared per scheme immediately before that scheme is rewritten |
| `kms:<scheme>:published_concept:uuid:<uuid>` | `kms:platforms:published_concept:uuid:ea7fd15d-190d-43f3-bdd3-75f5d88dc3f8` | Current published UUID-to-path lookup for metadata correction replacement resolution | Same body as the matching published full-path/short-name lookup | `primePublishedConceptCacheFromCsv` | Cleared per scheme immediately before that scheme is rewritten |

#### Important behavior

- Draft API response cache keys are intentionally skipped.
  Reads and writes through `getCachedJsonResponse` / `setCachedJsonResponse` do not populate the
  shared Redis response cache for `version=draft`.

- `primeConceptsCache` only manages published API response caches.
  When the published version marker changes, it clears:
  - `kms:concepts:*`
  - `kms:concept:*`
  - `kms:tree:*`

- `primePublishedConceptCacheFromCsv` manages the current published metadata-correction lookups.
  Before writing one scheme, it clears only:
  - `kms:<normalized-scheme>:published_concept:*`

- `buildHistoricalConceptCache` is intentionally incremental.
  Historical S3 version directories are treated as immutable. Once a version is fully written to
  Redis, its version name is added to `kms:historical_concept:versions:built:v1` and future runs
  skip it.

- Scheme names are normalized in Redis key namespaces.
  In particular, `granuledataformat` uses the `dataformat` namespace so both names resolve to the
  same lookup keys.

- Some callers intentionally bypass the published response cache.
  For example, publisher-owned reads can pass `bypassCache=true` so publish-time CSV export reads
  come from the source of truth instead of a stale published `/concepts` cache entry.

## Local Testing

To run the test suite, run:

```
npm run test
```

## XML Metadata Path Editor

`serverless/src/shared/XmlMetadataPathEditor.js` is the shared XML mutation engine used by XML-native metadata delegates. It exists so we can make targeted keyword updates against a DOM instead of converting the whole XML document into a generic JavaScript object and rebuilding it from scratch. The first consumer is DIF10 through `serverless/src/shared/dif10DomEditor.js`, but the editor is intentionally format-agnostic so later XML formats can reuse the same matching and mutation primitives.

At a high level, the flow is:

1. A delegate creates an editor from the raw XML payload.
2. A format-specific config chooses the right update mode for a scheme.
3. The editor uses XPath to find candidate XML nodes.
4. It matches the current XML content against the incoming KMS `oldKeywordPath`.
5. It applies a targeted `replace` or `delete`.
6. The delegate serializes the DOM back to XML once at the end.

### Reading An Existing Config

If you are trying to understand a config file like `serverless/src/shared/dif10DomEditor.js`, the easiest way to read it is from the outside in:

1. Start with the wrapper:
   - `blockScheme(...)`: repeated XML blocks such as `Science_Keywords`, `Location`, `Platform`, or `Organization`
   - `leafScheme(...)`: simple text nodes where the whole node value is the keyword
   - `scalarScheme(...)`: one-off root fields such as `Product_Level_Id`
2. Look at `nodeXPath`:
   - this tells you which XML nodes are candidates for the correction
3. Look at `find`:
   - `fieldPaths` says which XML fields are read from the candidate node
   - those fields are read in order and compared to the incoming KMS `oldKeywordPath`
   - the editor preserves empty `>` slots by default and pads missing trailing slots when `fieldPaths` describes a full hierarchy
   - `pathIndexes` controls which slot(s) from the normalized KMS path are compared
   - negative `pathIndexes` count from the end of the path, which is useful when the XML only stores the tail of a larger KMS path
4. Look at `replace`:
   - each entry says which XML field gets written
   - `source.type: 'path'` plus `source.pathIndex` means “take this segment from the new KMS path”
   - negative `source.pathIndex` values count from the end of `newKeywordPath`, which is useful when the XML stores only the tail of a larger KMS path
   - `source.type: 'param'` means “take this value from another correction property such as `newLongName`”
5. Look for cleanup hooks:
   - `removeNodeIfEmptyAfterReplace` removes the matched block if a replace clears all of its child fields
   - `removeEmptyParent` prunes an otherwise-empty parent container after a leaf delete
   - `afterReplace` and `afterDelete` are only for small format-specific cleanup steps after the main write/remove operation

Example, simplified from the DIF10 `platforms` config:

```js
platforms: blockScheme({
  nodeXPath: '//DIF/Platform',
  find: {
    fieldPaths: ['Short_Name'],
    pathIndexes: [-1]
  },
  replace: [
    {
      fieldPath: 'Type',
      source: { type: 'path', pathIndex: 1 }
    },
    {
      fieldPath: 'Short_Name',
      source: { type: 'path', pathIndex: 3 }
    },
    {
      fieldPath: 'Long_Name',
      source: { type: 'param', key: 'newLongName' }
    }
  ]
})
```

That reads as:

- search all `<Platform>` nodes
- match the one whose current `Short_Name` matches the last segment of `oldKeywordPath`
- on replace, write:
  - KMS segment `1` into `<Type>`
  - KMS segment `3` into `<Short_Name>`
  - `newLongName` into `<Long_Name>`

### Writing A New Config For Another XML Format

If you are creating a new format-specific config, treat `XmlMetadataPathEditor` as the reusable engine and keep the new file as a thin mapping layer.

Recommended approach:

1. Create a small format adapter file, similar to `dif10DomEditor.js`.
2. Keep matching path-based:
   - prefer matching by the current XML value derived from `oldKeywordPath`
   - do not rely on mutable positional indices inside the source XML
3. Choose the simplest update mode that fits:
   - repeated block: `blockScheme`
   - single text node: `leafScheme`
   - root scalar field: `scalarScheme`
4. Define `find.fieldPaths` in the same order as the KMS `>`-delimited path you expect to match.
5. Define `replace` so each XML field clearly states where its new value comes from:
   - a path segment
   - or a named correction parameter such as `newLongName`
6. Keep delete behavior conservative:
   - remove only the XML node that truly represents the controlled keyword value
   - avoid broader container deletes unless the format requires it
7. Add strong tests with the new config:
   - successful replace
   - successful delete
   - missing target is a no-op
   - optional field behavior
   - no-op preservation where unrelated XML content remains intact

Good rule of thumb:

- put reusable DOM/XPath behavior in `XmlMetadataPathEditor`
- put format-specific field mappings in the format adapter
- keep delegates thin, so adding the next XML format mostly means writing config and tests rather than building another XML engine

## Metadata Correction Service Contract

`serverless/src/metadataCorrectionService/handler.js` expects a collection-scoped correction request:

- `collectionConceptId`
- optional `keywordEvent`

The service then:

1. fetches the collection UMM/native metadata details from CMR
2. validates the collection against the published Redis cache
3. extracts invalid keyword values from UMM-C
4. resolves concrete corrections through the historical/published cache helpers
5. fetches the raw native metadata payload
6. invokes the native-format delegate
7. calls `serverless/src/shared/writeCorrectedMetadataToCmr.js`

`keywordEvent` is now optional and is used only as extra delete proof. Without delete-specific
event context, unresolved cache lookups are skipped rather than inferred as delete actions. At the
moment, runtime native-format support remains limited to `DIF10`.

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
- `bamboo_CMR_BASE_URL` is required. KMS no longer falls back to `https://cmr.earthdata.nasa.gov` during deploy or synth.
- If you are not deploying into an existing API Gateway, set `bamboo_EXISTING_API_ID` and `bamboo_ROOT_RESOURCE_ID` to empty strings.
- If `bamboo_RDF4J_BACKUP_VAULT_NAME` is set, `SnapshotStack` imports that existing backup vault. This is useful when `rdf4jSnapshotStack` is being recreated after an RDF4J recovery event and you need the new stack to reuse an existing vault instead of trying to create the same vault name again.
- If `bamboo_RDF4J_BACKUP_VAULT_NAME` is not set, `SnapshotStack` creates the default `rdf4j-backup-vault`.

#### Refresh RDF4J AMI / ASG

Use this when the RDF4J EC2 instance needs a refresh, for example after an AMI update or when
we want to replace the current instance cleanly. The normal operational path for that has been to
run this script. In practice, if the EC2 AMIs are on a 90-day refresh cadence, this is the step
we use to roll RDF4J onto the refreshed instance.

1. In `cloud.earthdata.nasa.gov`, generate short-term AWS credentials for the target account.
2. Paste those credentials into the same terminal where you will run the refresh:

   ```bash
   export AWS_ACCESS_KEY_ID=[temporary access key id]
   export AWS_SECRET_ACCESS_KEY=[temporary secret access key]
   export AWS_SESSION_TOKEN=[temporary session token]
   ```

3. Run the refresh script:

   ```bash
   ./bin/refresh_asg.sh
   ```

This script fully drains the RDF4J Auto Scaling Group to `0`, waits for the old instance to
terminate, and then brings the group back to `1` so a fresh EC2 instance comes up and ECS
stabilizes.

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
