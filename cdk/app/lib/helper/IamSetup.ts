import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

/**
 * Configures IAM roles and policies for the KMS Serverless Application.
 */
export class IamSetup {
  public lambdaRole: iam.Role

  /**
   * Creates an instance of IamSetup.
   * @param {Construct} scope - The scope in which to define this construct.
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} stage - The deployment stage (e.g., 'dev', 'prod').
   * @param {string} account - The AWS account ID.
   * @param {string} region - The AWS region.
   * @param {string} stackName - The name of the CloudFormation stack.
   */
  constructor(
    scope: Construct,
    prefix: string,
    stage: string,
    account: string,
    region: string,
    stackName: string
  ) {
    this.lambdaRole = new iam.Role(scope, `${prefix}-KmsServerlessAppRole`, {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('states.amazonaws.com'),
        new iam.ServicePrincipal('events.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyArn(
        scope,
        `${prefix}-NGAPShRoleBoundary`,
        `arn:aws:iam::${account}:policy/NGAPShRoleBoundary`
      )
    })

    this.addPolicies(prefix, stage, account, region, stackName)
  }

  /**
 * Creates a policy document for API Gateway that allows invocation of all API resources.
 *
 * This policy allows any principal to invoke any method on any resource in the API.
 * It's suitable for private APIs where network-level controls (like VPC endpoints)
 * are used to restrict access, rather than IAM-level controls.
 *
 * @returns {iam.PolicyDocument} A policy document allowing execute-api:Invoke on all resources.
 */
  public createApiGatewayPolicy(): iam.PolicyDocument {
    return new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          effect: iam.Effect.ALLOW,
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*']
        })
      ]
    })
  }

  /**
   * Adds all necessary policies to the Lambda role.
   * @private
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} stage - The deployment stage.
   * @param {string} account - The AWS account ID.
   * @param {string} region - The AWS region.
   * @param {string} stackName - The name of the CloudFormation stack.
   */
  private addPolicies(
    prefix: string,
    stage: string,
    account: string,
    region: string,
    stackName: string
  ) {
    this.addS3AccessPolicy(prefix, stage)
    this.addKMSLambdaBasePolicy()
    this.addLambdaInvocationPolicy(prefix, region, account, stage, stackName)
    this.addServiceDiscoveryPolicy(prefix, stage)
  }

  /**
   * Adds S3 access policy to the Lambda role.
   * @private
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} stage - The deployment stage.
   */
  private addS3AccessPolicy(prefix: string, stage: string) {
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:CreateBucket',
        's3:PutObject',
        's3:GetObject',
        's3:ListBucket',
        's3:PutLifecycleConfiguration',
        's3:GetBucketLocation',
        's3:ListAllMyBuckets',
        's3:HeadBucket'
      ],
      resources: [
        `arn:aws:s3:::kms-rdf-backup-${stage}`,
        `arn:aws:s3:::kms-rdf-backup-${stage}/*`,
        'arn:aws:s3:::kms-rdf-backup-ops',
        'arn:aws:s3:::kms-rdf-backup-ops/*'
      ]
    }))
  }

  /**
   * Adds base KMS Lambda policy to the Lambda role.
   * @private
   */
  private addKMSLambdaBasePolicy() {
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*']
    }))

    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: ['*']
    }))
  }

  /**
   * Adds Lambda invocation policy to the Lambda role.
   * @private
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} region - The AWS region.
   * @param {string} account - The AWS account ID.
   * @param {string} stage - The deployment stage.
   * @param {string} stackName - The name of the CloudFormation stack.
   */
  private addLambdaInvocationPolicy(
    prefix: string,
    region: string,
    account: string,
    stage: string,
    stackName: string
  ) {
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${region}:${account}:function:${prefix}-${stackName}-${stage}-publish`
      ]
    }))
  }

  /**
   * Adds service discovery policy to the Lambda role.
   * @private
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} stage - The deployment stage.
   */
  private addServiceDiscoveryPolicy(prefix: string, stage: string) {
    const serviceDiscoveryPolicy = new iam.Policy(this.lambdaRole, `${prefix}ServiceDiscoveryPolicy`, {
      policyName: `${prefix}-${stage}-ServiceDiscoveryPolicy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['servicediscovery:DiscoverInstances'],
          resources: ['*']
        })
      ]
    })

    this.lambdaRole.attachInlinePolicy(serviceDiscoveryPolicy)
  }
}
