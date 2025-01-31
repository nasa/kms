# KMS 2.0.0

Keyword Management System (KMS) is a application for maintaining keywords (science keywords, platforms, instruments, data centers, locations, projects, services, resolution, etc.) in the earthdata/IDN system.

## Links

## Getting Started

### Requirements

- [Node](https://nodejs.org/) (check .nvmrc for correct version)
  - [nvm](https://github.com/nvm-sh/nvm) is highly recommended

### Setup

To install the necessary components, run:

```bash
    npm install
```

### Usage

In order to run KMS locally, you first need to setup a RDF database.

#### Running Serverless Offline (API Gateway/Lambdas)

In order to run serverless-offline, which is used for mimicking API Gateway to call lambda functions, run:

```bash
    npm run offline
```

## Local Testing

To run the test suite, run:

```bash
    npm run test
```

## Deploying RDF Database
### Prerequisites
#### Copy your AWS credentials and set these up as env variables
```export AWS_ACCESS_KEY_ID=[your access key id]
export AWS_SECRET_ACCESS_KEY=[your access secret access key]
export AWS_SESSION_TOKEN=[your session token]
```
#### Retrieve the VPC_ID from AWS
```export VPC_ID=[your vpc id]
```
#### Set the RDFDB user name and password
```export RDFDB_USER_NAME=[your rdfdb user name]
export RDFDB_PASSWORD=[your rdfdb password]
```

### Deploy Docker Container to Registry
```cd infrastructure/rdfdb/cdk/bin
export 
./deploy_to_ecr.sh
```

### Deploy ECS Service to AWS
```cd infrastructure/rdfdb/cdk
cdk deploy rdf4jIamStack
cdk deploy rdf4jEfsStack
cdk deploy rdf4jEcsStack
```
One thing to note is if you destroy the rdf4jEfsStack and redeploy, this will create a new EFS file system.  You will need to copy the data from the old EFS file system to the new one.  This can be done by mounting the old EFS file system to an EC2 instance and copying the data to the new EFS file system.
