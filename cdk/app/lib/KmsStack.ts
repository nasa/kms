/* eslint-disable no-new */
import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as cr from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

import { ApiCacheSetup } from './helper/ApiCacheSetup'
import { ApiResources } from './helper/ApiResources'
import { IamSetup } from './helper/IamSetup'
import { LambdaFunctions } from './helper/KmsLambdaFunctions'
import { VpcSetup } from './helper/VpcSetup'

/**
 * Interface for KmsStack properties.
 * @interface
 */
export interface KmsStackProps extends cdk.StackProps {
  existingApiId: string | undefined
  prefix: string
  rootResourceId: string | undefined
  stage: string
  vpcId: string
  environment: {
    CMR_BASE_URL: string
    CONCEPTS_READ_TIMEOUT_MS?: string
    EDL_PASSWORD: string
    KMS_CACHE_CLUSTER_ENABLED?: string
    KMS_CACHE_CLUSTER_SIZE_GB?: string
    KMS_CACHE_TTL_SECONDS?: string
    LOG_LEVEL: string
    RDF_BUCKET_NAME: string
    RDF4J_PASSWORD: string
    RDF4J_SERVICE_URL: string
    RDF4J_USER_NAME: string
    SPARQL_COLD_MAX_RETRIES?: string
    SPARQL_REQUEST_TIMEOUT_MS?: string
    SPARQL_WARM_MAX_RETRIES?: string
    SPARQL_WARM_WINDOW_MS?: string
  }
}

/**
 * Represents a CDK stack for KMS, API Gateway, and Lambda resources.
 * @extends cdk.Stack
 */
export class KmsStack extends cdk.Stack {
  private readonly stage: string

  public vpc: ec2.IVpc

  public securityGroup: ec2.SecurityGroup

  public lambdaRole: iam.Role

  public api: apigateway.IRestApi

  private readonly lambdaFunctions: LambdaFunctions

  /**
   * Represents a CDK stack for KMS (Keyword Management System), API Gateway, and Lambda resources.
   * This stack sets up the infrastructure for a serverless keyword management system, including:
   *
   * 1. VPC and Security Group configuration for Lambda functions
   * 2. IAM roles and policies for secure access
   * 3. Integration with an existing API Gateway
   * 4. Creation and configuration of multiple Lambda functions for various operations:
   *    - Read operations (e.g., get concepts, get schemes)
   *    - Tree operations (e.g., get keyword tree)
   *    - CRUD operations (e.g., create, update, delete concepts)
   *    - Scheduled operations (e.g., export RDF to S3)
   * 5. API Gateway deployment
   * 6. CloudFormation outputs for important resources
   *
   * The stack is designed to work with an existing VPC and API Gateway, extending their
   * functionality to support a comprehensive keyword management system.
   *
   * @extends cdk.Stack
   */
  constructor(scope: Construct, id: string, props: KmsStackProps) {
    super(scope, id, props)
    const {
      environment, existingApiId, prefix, rootResourceId, stage, vpcId
    } = props
    this.stage = stage

    const useLocalstack = this.node.tryGetContext('useLocalstack') === 'true'

    // Set up VPC and Security Group
    const vpcSetup = new VpcSetup(this, prefix, vpcId, useLocalstack)
    this.vpc = vpcSetup.vpc
    this.securityGroup = vpcSetup.securityGroup

    // Set up IAM roles
    const iamSetup = new IamSetup(
      this,
      'IamSetup',
      this.stage,
      this.account,
      this.region,
      this.stackName
    )
    this.lambdaRole = iamSetup.lambdaRole

    const cacheTtlSeconds = Number(props.environment.KMS_CACHE_TTL_SECONDS)
    const cacheTtl = Number.isFinite(cacheTtlSeconds) && cacheTtlSeconds > 0
      ? cdk.Duration.seconds(cacheTtlSeconds)
      : cdk.Duration.hours(1)

    const cacheClusterSize = props.environment.KMS_CACHE_CLUSTER_SIZE_GB

    const cacheClusterEnabled = props.environment.KMS_CACHE_CLUSTER_ENABLED !== 'false'
    const cacheMethodOptions = cacheClusterEnabled
      ? ApiCacheSetup.cacheMethodOptions(cacheTtl)
      : undefined
    const cacheStageOptions = cacheClusterEnabled
      ? {
        cacheClusterEnabled: true,
        cacheClusterSize
      }
      : {}

    const accessLogGroupName = `/aws/apigateway/${prefix}-${stage}-access`
    const accessLogGroup = useLocalstack
      ? undefined
      : logs.LogGroup.fromLogGroupName(this, 'ApiAccessLogs', accessLogGroupName)

    const ensureAccessLogGroup = useLocalstack
      ? undefined
      : new cr.AwsCustomResource(this, 'EnsureApiAccessLogGroup', {
        onCreate: {
          service: 'CloudWatchLogs',
          action: 'createLogGroup',
          parameters: {
            logGroupName: accessLogGroupName
          },
          physicalResourceId: cr.PhysicalResourceId.of(accessLogGroupName),
          ignoreErrorCodesMatching: 'ResourceAlreadyExistsException'
        },
        onUpdate: {
          service: 'CloudWatchLogs',
          action: 'createLogGroup',
          parameters: {
            logGroupName: accessLogGroupName
          },
          ignoreErrorCodesMatching: 'ResourceAlreadyExistsException'
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new iam.PolicyStatement({
            actions: ['logs:CreateLogGroup'],
            resources: ['*']
          })
        ])
      })

    const accessLogOptions = useLocalstack
      ? {}
      : {
        accessLogDestination: new apigateway.LogGroupLogDestination(
            accessLogGroup as logs.ILogGroup
        ),
        accessLogFormat: apigateway.AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            method: '$context.httpMethod',
            path: '$context.path',
            queryString: '$context.queryString',
            status: '$context.status',
            responseLatency: '$context.responseLatency',
            integrationLatency: '$context.integrationLatency'
          })
        )
      }

    if (existingApiId && rootResourceId) {
      // Import existing API Gateway
      this.api = apigateway.RestApi.fromRestApiAttributes(
        this,
        'ApiGatewayRestApi',
        {
          restApiId: existingApiId,
          rootResourceId
        }
      )
    } else {
      // Create a new API Gateway
      this.api = new apigateway.RestApi(this, 'ApiGatewayRestApi', {
        restApiName: `${prefix}-api`,
        description: 'API Gateway for KMS',
        endpointTypes: [apigateway.EndpointType.PRIVATE],
        deploy: true,
        deployOptions: {
          stageName: stage,
          ...(useLocalstack
            ? {}
            : {
              ...cacheStageOptions,
              ...(cacheMethodOptions ? { methodOptions: cacheMethodOptions } : {}),
              ...accessLogOptions
            })
        },
        policy: iamSetup.createApiGatewayPolicy()
      })
    }

    const apiResources = new ApiResources({
      api: this.api,
      prefix: props.prefix
    })
    // Configure CORS for the entire API
    apiResources.configureCors(this, prefix)

    // Set up Lambda functions
    this.lambdaFunctions = new LambdaFunctions(this, {
      api: this.api,
      apiResources,
      environment,
      lambdaRole: this.lambdaRole,
      prefix,
      securityGroup: this.securityGroup,
      stage: this.stage,
      vpc: this.vpc,
      useLocalstack
    })

    const lambdas = this.lambdaFunctions.getAllLambdas()
    const methods = this.lambdaFunctions.getAllMethods()

    // Create a new deployment
    const deployment = new apigateway.Deployment(
      this,
      `ApiDeployment-${Date.now().toString()}`,
      {
        api: this.api,
        retainDeployments: false,
        description: `Deployment for ${stage} at ${new Date().toISOString()}`
      }
    )

    // Ensure deployment happens after all routes/methods/integrations exist
    if (lambdas) {
      Object.values(lambdas).forEach((lambda) => {
        deployment.node.addDependency(lambda)
      })
    }

    if (methods.length) {
      methods.forEach((method) => deployment.node.addDependency(method))
    }

    // Create Stage for the deployment
    if (existingApiId) {
      // For existing API, create a new Stage managed by CDK
      const stageResource = new apigateway.Stage(this, 'ApiStage', {
        deployment,
        stageName: stage,
        description: `${stage} stage name for KMS API`,
        ...(useLocalstack
          ? {}
          : {
            ...cacheStageOptions,
            ...(cacheMethodOptions ? { methodOptions: cacheMethodOptions } : {}),
            ...accessLogOptions
          })
      })

      if (ensureAccessLogGroup) {
        stageResource.node.addDependency(ensureAccessLogGroup)
      }
    } else {
      // For new API, stage is auto-created
      this.api.deploymentStage?.node.addDependency(deployment)

      if (ensureAccessLogGroup) {
        this.api.deploymentStage?.node.addDependency(ensureAccessLogGroup)
      }
    }

    // Output the new deployment ID
    new cdk.CfnOutput(this, 'NewDeploymentId', {
      value: deployment.deploymentId,
      description: 'ID of the new API Gateway deployment',
      exportName: `${prefix}-NewApiDeploymentId`
    })

    // Configure API Gateway caching
    if (existingApiId && !useLocalstack && cacheClusterEnabled) {
      ApiCacheSetup.configure(this, this.api)
    }

    this.addOutputs(prefix)
  }

  /**
   * Adds CloudFormation outputs to the stack.
   * @private
   * @param {string} prefix - Prefix for the output names.
   */
  private addOutputs(prefix: string) {
    const { region } = cdk.Stack.of(this)
    const urlSuffix = cdk.Aws.URL_SUFFIX
    const apiUrl = `https://${this.api.restApiId}.execute-api.${region}.${urlSuffix}/${this.stage}`

    new cdk.CfnOutput(this, 'ApiRootResourceId', {
      description: 'The ID of the API Gateway root resource',
      exportName: `${prefix}-KmsApiRootResourceId`,
      value: this.api.restApiRootResourceId
    })

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      description: 'The URL of the API Gateway',
      exportName: `${prefix}-KmsApiGatewayUrl`,
      value: apiUrl
    })

    new cdk.CfnOutput(this, 'ApiId', {
      description: 'The ID of the API Gateway',
      exportName: `${prefix}-KmsApiId`,
      value: this.api.restApiId
    })

    new cdk.CfnOutput(this, 'AuthorizerId', {
      description: 'The ID of the API Gateway Authorizer',
      exportName: `${prefix}-KmsAuthorizerId`,
      value: this.lambdaFunctions.authorizer.authorizerId
    })

    new cdk.CfnOutput(this, 'KMSLambdaSecurityGroup', {
      exportName: `${this.stage}-kms-LambdaSecurityGroup`,
      value: this.securityGroup.securityGroupId
    })

    new cdk.CfnOutput(this, 'KMSServerlessAppRoleArn', {
      description:
        'Role used to execute commands across the serverless application',
      exportName: `${this.stage}-KMSServerlessCdkAppRole`,
      value: this.lambdaRole.roleArn
    })
  }
}
