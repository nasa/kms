# KMS 2.0

Keyword Management System (KMS) is a application for maintaining keywords (science keywords, platforms, instruments, data centers, locations, projects, services, resolution, etc.) in the GCMD/IDN system.

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

