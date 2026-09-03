import * as fs from 'fs'
import * as path from 'path'

import * as cdk from 'aws-cdk-lib'
import * as docdb from 'aws-cdk-lib/aws-docdb'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as customResources from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

import { getDocumentDbCertificateBundling } from './helper/DocumentDbLambdaConfig'
import { MetadataCorrectionAuditDatabaseSetup } from './helper/MetadataCorrectionAuditDatabaseSetup'
import { NODE_LAMBDA_RUNTIME } from './helper/NodeLambdaRuntime'

const PROJECT_ROOT = path.join(__dirname, '../../..')
const METADATA_CORRECTION_AUDIT_INDEXES = JSON.parse(fs.readFileSync(
  path.join(PROJECT_ROOT, 'config/metadataCorrectionAuditIndexes.json'),
  'utf8'
))

export interface MetadataCorrectionAuditStackProps extends cdk.StackProps {
  localUri?: string
  maxCapacity?: number
  minCapacity?: number
  prefix: string
  stage: string
  useLocalstack: boolean
  vpcId: string
}

/**
 * Shared DocumentDB infrastructure for metadata-correction audit readers and writers.
 */
export class MetadataCorrectionAuditStack extends cdk.Stack {
  public readonly cluster?: docdb.DatabaseCluster

  public readonly clientSecurityGroup?: ec2.SecurityGroup

  public readonly connectionEnvironment: Record<string, string>

  public readonly secret?: secretsmanager.ISecret

  /**
   * Creates the shared audit database resources and exposes their Lambda connection settings.
   *
   * @param scope Parent CDK construct.
   * @param id Stack identifier.
   * @param props Environment, VPC, and serverless capacity configuration.
   */
  constructor(
    scope: Construct,
    id: string,
    props: MetadataCorrectionAuditStackProps
  ) {
    super(scope, id, props)

    const vpc = props.useLocalstack
      ? undefined
      : ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId })
    const databaseSetup = new MetadataCorrectionAuditDatabaseSetup(
      this,
      'Database',
      {
        localUri: props.localUri,
        maxCapacity: props.maxCapacity,
        minCapacity: props.minCapacity,
        prefix: props.prefix,
        stage: props.stage,
        useLocalstack: props.useLocalstack,
        vpc
      }
    )

    this.cluster = databaseSetup.cluster
    this.clientSecurityGroup = databaseSetup.clientSecurityGroup
    this.connectionEnvironment = databaseSetup.environment
    this.secret = databaseSetup.secret

    if (
      !props.useLocalstack
      && vpc
      && this.cluster
      && this.clientSecurityGroup
      && this.secret
      && databaseSetup.dbInstance
    ) {
      // Define the deployment Lambda that connects to DocumentDB and creates the indexes.
      const indexInitializer = new NodejsFunction(this, 'IndexInitializer', {
        functionName: `${props.prefix}-${props.stage}-metadata-correction-audit-indexes`,
        entry: path.join(
          PROJECT_ROOT,
          'serverless/src/initializeMetadataCorrectionAudit/handler.js'
        ),
        handler: 'initializeMetadataCorrectionAudit',
        runtime: NODE_LAMBDA_RUNTIME,
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        environment: this.connectionEnvironment,
        ...getDocumentDbCertificateBundling(this.connectionEnvironment),
        depsLockFilePath: path.join(PROJECT_ROOT, 'package-lock.json'),
        projectRoot: PROJECT_ROOT,
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        securityGroups: [this.clientSecurityGroup]
      })
      this.secret.grantRead(indexInitializer)

      // Register the initializer as the handler for CloudFormation custom-resource events.
      const indexProvider = new customResources.Provider(this, 'IndexProvider', {
        onEventHandler: indexInitializer
      })

      // Invoke the provider when this stack creates or updates the audit index resource.
      const indexResource = new cdk.CustomResource(this, 'Indexes', {
        serviceToken: indexProvider.serviceToken,
        properties: {
          ClusterEndpoint: this.cluster.clusterEndpoint.hostname,
          IndexDefinitions: METADATA_CORRECTION_AUDIT_INDEXES
        }
      })
      indexResource.node.addDependency(databaseSetup.dbInstance)
    }
  }
}

export default MetadataCorrectionAuditStack
