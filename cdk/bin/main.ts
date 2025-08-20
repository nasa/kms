#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'

import { KmsStack, KmsStackProps } from '../app/lib/KmsStack'
import { EbsStack } from '../rdfdb/lib/EbsStack'
import { EcsStack } from '../rdfdb/lib/EcsStack'
import { IamStack } from '../rdfdb/lib/IamStack'
import { LoadBalancerStack } from '../rdfdb/lib/LoadBalancerStack'
import { SnapshotStack } from '../rdfdb/lib/SnapshotStack'

/**
 * This script sets up and deploys multiple AWS CDK stacks for a cloud infrastructure.
 * It includes stacks for IAM, Load Balancer, EBS, ECS, Snapshot, and KMS.
 *
 * @requires aws-cdk-lib
 * @requires ../app/lib/KmsStack
 * @requires ../rdbdb/lib/EbsStack
 * @requires ../rdbdb/lib/EcsStack
 * @requires ../rdbdb/lib/IamStack
 * @requires ../rdbdb/lib/LoadBalancerStack
 * @requires ../rdbdb/lib/SnapshotStack
 *
 * @description
 * The main function performs the following tasks:
 * 1. Sets up environment variables and CDK app context
 * 2. Creates IAM, Load Balancer, EBS, ECS, and Snapshot stacks
 * 3. Establishes dependencies between stacks
 * 4. Creates and configures a KMS stack
 * 5. Synthesizes the CDK app
 *
 * @throws {Error} If required environment variables are not set
 *
 * @example
 * To run the script:
 * ```
 * ./kms.ts
 * ```
 */
async function main() {
  const prefix = process.env.STACK_PREFIX || 'kms'
  const stage = process.env.STAGE_NAME || 'dev'
  const existingApiId = process.env.EXISTING_API_ID
  const rootResourceId = process.env.ROOT_RESOURCE_ID

  const app = new cdk.App({
    context: {
      '@aws-cdk/aws-ecs:enableImdsBlockingDeprecatedFeature': true
    }
  })

  const env: cdk.Environment = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }

  const vpcId = process.env.VPC_ID

  if (!vpcId) {
    throw new Error('VPC_ID environment variable is not set')
  }

  // Create IAM Stack
  const iamStack = new IamStack(app, 'rdf4jIamStack', {
    env,
    vpcId,
    stackName: 'rdf4jIamStack'
  })

  // Create Load Balancer Stack
  const lbStack = new LoadBalancerStack(app, 'rdf4jLoadBalancerStack', {
    env,
    vpcId,
    stackName: 'rdf4jLoadBalancerStack'
  })

  // Create EBS Stack
  const ebsStack = new EbsStack(app, 'rdf4jEbsStack', {
    env,
    vpcId,
    stackName: 'rdf4jEbsStack'
  })

  // Create ECS Stack
  const ecsStack = new EcsStack(app, 'rdf4jEcsStack', {
    env,
    vpcId,
    roleArn: iamStack.role.roleArn,
    lbStack,
    ebsStack,
    stackName: 'rdf4jEcsStack'
  })

  // Create Snapshot Stack
  const snapshotStack = new SnapshotStack(app, 'rdf4jSnapshotStack', {
    env,
    ebsVolumeId: ebsStack.volume.volumeId,
    stackName: 'rdf4jSnapshotStack'
  })

  // Add dependencies
  ebsStack.addDependency(iamStack)
  lbStack.addDependency(iamStack)
  ecsStack.addDependency(iamStack)
  ecsStack.addDependency(ebsStack)
  ecsStack.addDependency(lbStack)
  snapshotStack.addDependency(ebsStack)

  // Create KmsStack
  const kmsStackProps: KmsStackProps = {
    prefix,
    env,
    vpcId,
    stackName: `${prefix}-KmsStack`,
    stage,
    existingApiId,
    rootResourceId,
    environment: {
      RDF4J_SERVICE_URL: lbStack.rdf4jServiceUrl,
      RDF4J_USER_NAME: process.env.RDF4J_USER_NAME || 'rdf4j',
      RDF4J_PASSWORD: process.env.RDF4J_PASSWORD || 'rdf4j',
      CMR_BASE_URL: process.env.CMR_BASE_URL || 'https://cmr.earthdata.nasa.gov',
      EDL_PASSWORD: process.env.EDL_PASSWORD || '',
      CORS_ORIGIN: process.env.CORS_ORIGIN || '*.earthdata.nasa.gov,http://localhost:5173'
    }
  }

  const kmsStack = new KmsStack(app, 'KmsStack', kmsStackProps)
  kmsStack.addDependency(ecsStack)

  app.synth()
}

main().catch((error) => {
  console.error('An error occurred:', error)
  process.exit(1)
})
