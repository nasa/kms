#!/usr/bin/env node
const cdk = require('aws-cdk-lib')
const { EcsStack } = require('../lib/ecs-stack')
const { EfsStack } = require('../lib/efs-stack')
const { IamStack } = require('../lib/iam-stack')

async function main() {
  const app = new cdk.App()

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }

  const vpcId = process.env.VPC_ID

  const iamStack = new IamStack(app, 'rdf4jIamStack', {
    env,
    vpcId
  })
  const efsStack = new EfsStack(app, 'rdf4jEfsStack', {
    env,
    vpcId,
    efsTaskSecurityGroup: iamStack.efsTaskSecurityGroup
  })

  const ecsStack = new EcsStack(app, 'rdf4jEcsStack', {
    env,
    vpcId,
    role: iamStack.role,
    ecsTasksSecurityGroup: efsStack.ecsTasksSecurityGroup,
    fileSystem: efsStack.fileSystem,
    accessPoint: efsStack.accessPoint
  })

  // Add dependencies
  efsStack.addDependency(iamStack)
  ecsStack.addDependency(iamStack)
  ecsStack.addDependency(efsStack)

  app.synth()
}

main()
