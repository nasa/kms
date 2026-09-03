import * as cdk from 'aws-cdk-lib'
import * as docdb from 'aws-cdk-lib/aws-docdb'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'

interface MetadataCorrectionAuditDatabaseSetupProps {
  databaseName?: string
  localUri?: string
  maxCapacity?: number
  minCapacity?: number
  prefix: string
  stage: string
  useLocalstack: boolean
  vpc?: ec2.IVpc
}

/**
 * Provisions the shared DocumentDB Serverless cluster used by metadata-correction auditing.
 */
export class MetadataCorrectionAuditDatabaseSetup extends Construct {
  public readonly cluster?: docdb.DatabaseCluster

  public readonly clientSecurityGroup?: ec2.SecurityGroup

  public readonly environment: Record<string, string>

  public readonly secret?: secretsmanager.ISecret

  /**
   * Configures a local MongoDB URI for LocalStack, or provisions the deployed DocumentDB cluster,
   * secret, TLS environment, and paired database/client security groups.
   *
   * @param scope Parent CDK construct.
   * @param id Construct identifier.
   * @param props Local or deployed database configuration.
   */
  constructor(
    scope: Construct,
    id: string,
    props: MetadataCorrectionAuditDatabaseSetupProps
  ) {
    super(scope, id)

    const databaseName = props.databaseName || 'kms'
    const commonEnvironment = {
      DOCUMENTDB_DATABASE_NAME: databaseName,
      DOCUMENTDB_AUDIT_COLLECTION_NAME: 'metadataCorrectionAudits',
      DOCUMENTDB_MAX_POOL_SIZE: '5'
    }

    if (props.useLocalstack) {
      this.environment = {
        ...commonEnvironment,
        DOCUMENTDB_URI: props.localUri || 'mongodb://kms-documentdb-local:27017/?directConnection=true'
      }

      return
    }

    if (!props.vpc) {
      throw new Error('A VPC is required for a deployed DocumentDB cluster')
    }

    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'DocumentDB access for KMS metadata-correction audit Lambdas'
    })
    this.clientSecurityGroup = new ec2.SecurityGroup(this, 'ClientSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Shared client access to the KMS metadata-correction audit database'
    })

    databaseSecurityGroup.addIngressRule(
      this.clientSecurityGroup,
      ec2.Port.tcp(27017),
      'Allow metadata-correction audit clients'
    )

    this.cluster = new docdb.DatabaseCluster(this, 'Cluster', {
      dbClusterName: `${props.prefix}-${props.stage}-metadata-correction-audit`,
      engineVersion: '8.0.0',
      masterUser: {
        username: 'kms_audit',
        secretName: `${props.prefix}/${props.stage}/metadata-correction-audit/documentdb`
      },
      serverlessV2ScalingConfiguration: {
        minCapacity: props.minCapacity || 0.5,
        maxCapacity: props.maxCapacity || 4
      },
      backup: {
        retention: cdk.Duration.days(7)
      },
      deletionProtection: ['ops', 'prod'].includes(props.stage.toLowerCase()),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      storageEncrypted: true,
      securityGroup: databaseSecurityGroup,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }
    })

    this.secret = this.cluster.secret

    if (!this.secret) {
      throw new Error('DocumentDB did not create a master-user secret')
    }

    this.environment = {
      ...commonEnvironment,
      DOCUMENTDB_HOST: this.cluster.clusterEndpoint.hostname,
      DOCUMENTDB_PORT: this.cluster.clusterEndpoint.port.toString(),
      DOCUMENTDB_SECRET_ARN: this.secret.secretArn,
      DOCUMENTDB_TLS_CA_FILE: '/var/task/us-east-1-bundle.pem'
    }
  }
}

export default MetadataCorrectionAuditDatabaseSetup
