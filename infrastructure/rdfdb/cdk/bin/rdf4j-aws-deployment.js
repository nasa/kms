#!/usr/bin/env node
const cdk = require('aws-cdk-lib')

const { EbsStack } = require('../lib/ebs-stack')
const { EcsStack } = require('../lib/ecs-stack')
const { IamStack } = require('../lib/iam-stack')
const { LoadBalancerStack } = require('../lib/lb-stack')

async function main() {
  const app = new cdk.App({
    context: {
      '@aws-cdk/aws-ecs:enableImdsBlockingDeprecatedFeature': true
    }
  })

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }

  const vpcId = process.env.VPC_ID

  const iamStack = new IamStack(app, 'rdf4jIamStack', {
    env,
    vpcId
  })

  const lbStack = new LoadBalancerStack(app, 'rdf4jLoadBalancerStack', {
    env,
    vpcId
  })

  const ebsStack = new EbsStack(app, 'rdf4jEbsStack', {
    env,
    vpcId
  })

  const ecsStack = new EcsStack(app, 'rdf4jEcsStack', {
    env,
    vpcId,
    roleArn: iamStack.role.roleArn,
    lbStack,
    ebsStack
  })

  // Add dependencies
  ebsStack.addDependency(iamStack)
  lbStack.addDependency(iamStack)
  ecsStack.addDependency(iamStack)
  ecsStack.addDependency(ebsStack)
  ecsStack.addDependency(lbStack)

  app.synth()
}

main()
