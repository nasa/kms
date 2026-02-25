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

To start local server (including rdf4j database server, cdk synth and sam)
```
npm run start-local
```

To run local server with SAM watch mode enabled
```
npm run start-local:watch
```

### Optional: Enable Redis cache in local SAM/LocalStack

By default, local `start-local` does not provision Redis in CDK. You can still test Redis caching by running Redis in Docker and using environment variables from your shell.

1. Ensure the docker network exists:
```
npm run rdf4j:create-network
```

2. Start Redis on the same docker network used by SAM:
```
npm run redis:start
```

3. (Optional) override defaults if needed:
```
export REDIS_ENABLED=true
export REDIS_HOST=kms-redis-local
export REDIS_PORT=6379
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
export REDIS_ENABLED=false
```

### Invoke cache-prime cron locally

Use this to run the same Lambda target used by the hourly cron:
```
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
#### Set the RDFDB user name and password
```
export RDF4J_USER_NAME=[user name]
export RDF4J_PASSWORD=[password]
```
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
## Deploying RDF Database to AWS
### Prerequisites
#### Copy your AWS credentials and set these up as env variables
```
export AWS_ACCESS_KEY_ID=${your access key id}
export AWS_SECRET_ACCESS_KEY=${your secret access key}
export AWS_SESSION_TOKEN=${your session token}
export VPC_ID={your vpc id}
```
#### Set the RDFDB user name and password
```
export RDF4J_USER_NAME=[your rdfdb user name]
export RDF4J_PASSWORD=[your rdfdb password]
export RDF4J_CONTAINER_MEMORY_LIMIT=[7168 for sit|uat, 14336 for prod]
```

#### Deploy Docker Container to Registry
```
cd cdk/rdfdb/bin
./deploy_to_ecr.sh
```

#### Deploy ECS Service to AWS
#### Deploy IAM, EBS, LB, and ECS stacks
```
export RDF4J_USER_NAME=[your rdfdb user name]
export RDF4J_PASSWORD=[your rdfdb password]
export RDF4J_CONTAINER_MEMORY_LIMIT=[7168 for sit|uat, 14336 for prod]
export RDF4J_INSTANCE_TYPE=["M5.LARGE" for sit|uat, "R5.LARGE" for prod]

cd cdk
cdk deploy rdf4jIamStack
cdk deploy rdf4jEbsStack
cdk deploy rdf4jLbStack
cdk deploy rdf4jEcsStack
cdk deploy rdf4jSnapshotStack
cdk deploy KmsStack
```
#### Alternatively, you can deploy all stacks at once
```
cd cdk
cdk deploy --all
```
One thing to note is if you destroy the rdf4jEbsStack and redeploy, this will create a new EBS file system.  You will need to copy the data from the old EBS file system to the new one.  This can be done by mounting the old EBS file system to an EC2 instance and copying the data to the new EBS file system.

## Deploying KMS to AWS
### Prerequisites
#### Copy your AWS credentials and set these up as env variables
```
export bamboo_STAGE_NAME=[sit|uat|prod]
export bamboo_AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
export bamboo_AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
export bamboo_AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN}
export bamboo_LAMBDA_TIMEOUT=30
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
export bamboo_RDF_BUCKET_NAME=[name of bucket for storing archived versions]
export bamboo_EXISTING_API_ID=[api id if deploying this into an existing api gateway]
export bamboo_ROOT_RESOURCE_ID=[see CDK_MIGRATION.md for how to determine]
```
#### Deploy KMS Application
```
./bin/deploy-bamboo.sh
```
