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

#### Running Serverless Offline (API Gateway/Lambdas)

In order to run serverless-offline, which is used for mimicking API Gateway to call lambda functions, run:

```
RDF4J_SERVICE_URL=http://localhost:8080 npm run offline
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
#### Run the docker image
```
npm run rdf4j:start
```
#### Setup and load data into the RDF database
```
npm run rdf4j:setup
```

# Deployments
## Deploying RDF Database to AWS
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
```
#### Retrieve the VPC_ID from AWS
```
export VPC_ID=[your vpc id]
```
#### Set the RDFDB user name and password
```
export RDF4J_USER_NAME=[your rdfdb user name]
export RDF4J_PASSWORD=[your rdfdb password]
```

#### Deploy Docker Container to Registry
```
cd infrastructure/rdfdb/cdk/bin
./deploy_to_ecr.sh
```

#### Deploy ECS Service to AWS
#### Deploy IAM, EBS, LB, and ECS stacks
```
cd infrastructure/rdfdb/cdk
cdk deploy rdf4jIamStack
cdk deploy rdf4jEbsStack
cdk deploy rdf4jLbStack
cdk deploy rdf4jEcsStack
```
#### Alternatively, you can deploy all stacks at once
```
cd infrastructure/rdfdb/cdk
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
```
#### Deploy KMS Application
```
./bin/deploy_bamboo.sh
```

