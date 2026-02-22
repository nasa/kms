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
 * ./main.ts
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

  const useLocalstack = app.node.tryGetContext('useLocalstack') === 'true'

  const env: cdk.Environment = useLocalstack
    ? {
      account: '000000000000',
      region: 'us-east-1'
    }
    : {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
    }

  const vpcId = useLocalstack ? 'dummy-vpc-id' : process.env.VPC_ID

  if (!vpcId) {
    throw new Error('VPC_ID environment variable is not set')
  }

  let iamStack: IamStack | undefined
  let lbStack: LoadBalancerStack | undefined
  let ebsStack: EbsStack | undefined
  let ecsStack: EcsStack | undefined
  let snapshotStack: SnapshotStack | undefined
  if (!useLocalstack) {
    // Create IAM Stack
    iamStack = new IamStack(app, 'rdf4jIamStack', {
      env,
      vpcId,
      stackName: 'rdf4jIamStack'
    })

    // Create Load Balancer Stack
    lbStack = new LoadBalancerStack(app, 'rdf4jLoadBalancerStack', {
      env,
      vpcId,
      stackName: 'rdf4jLoadBalancerStack'
    })

    // Create EBS Stack
    ebsStack = new EbsStack(app, 'rdf4jEbsStack', {
      env,
      vpcId,
      stackName: 'rdf4jEbsStack'
    })

    // Create ECS Stack
    ecsStack = new EcsStack(app, 'rdf4jEcsStack', {
      env,
      vpcId,
      roleArn: iamStack.role.roleArn,
      lbStack,
      ebsStack,
      stackName: 'rdf4jEcsStack'
    })

    // Create Snapshot Stack
    snapshotStack = new SnapshotStack(app, 'rdf4jSnapshotStack', {
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
  }

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
      RDF4J_SERVICE_URL: useLocalstack
        ? 'http://rdf4j-server:8080'
        : (lbStack?.rdf4jServiceUrl || process.env.RDF4J_SERVICE_URL || 'http://localhost:8081'),
      RDF4J_USER_NAME: process.env.RDF4J_USER_NAME || 'rdf4j',
      RDF4J_PASSWORD: process.env.RDF4J_PASSWORD || 'rdf4j',
      RDF_BUCKET_NAME: process.env.RDF_BUCKET_NAME || 'kms-rdf-backup',
      CMR_BASE_URL: process.env.CMR_BASE_URL || 'https://cmr.earthdata.nasa.gov',
      EDL_PASSWORD: process.env.EDL_PASSWORD || '',
      LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
      CONCEPTS_READ_TIMEOUT_MS: process.env.CONCEPTS_READ_TIMEOUT_MS || '30000',
      SPARQL_WARM_WINDOW_MS: process.env.SPARQL_WARM_WINDOW_MS || '60000',
      SPARQL_WARM_MAX_RETRIES: process.env.SPARQL_WARM_MAX_RETRIES || '0',
      SPARQL_COLD_MAX_RETRIES: process.env.SPARQL_COLD_MAX_RETRIES || '1',
      SPARQL_REQUEST_TIMEOUT_MS: process.env.SPARQL_REQUEST_TIMEOUT_MS || '0',
      KMS_CACHE_TTL_SECONDS: process.env.KMS_CACHE_TTL_SECONDS || '3600',
      KMS_CACHE_CLUSTER_SIZE_GB: process.env.KMS_CACHE_CLUSTER_SIZE_GB || '0.5',
      KMS_CACHE_CLUSTER_ENABLED: process.env.KMS_CACHE_CLUSTER_ENABLED || 'false'
    }
  }

  const kmsStack = new KmsStack(app, 'KmsStack', kmsStackProps)
  // Add dependency only if ecsStack is defined
  if (!useLocalstack && ecsStack) {
    kmsStack.addDependency(ecsStack)
  }

  app.synth()
}

main().catch((error) => {
  console.error('An error occurred:', error)
  process.exit(1)
})
