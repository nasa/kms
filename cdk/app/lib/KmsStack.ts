/* eslint-disable no-new */
import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

import { ApiResources } from './helper/ApiResources'
import { IamSetup } from './helper/IamSetup'
import { LambdaFunctions } from './helper/KmsLambdaFunctions'
import { VpcSetup } from './helper/VpcSetup'

/**
 * Interface for KmsStack properties.
 * @interface
 */
export interface KmsStackProps extends cdk.StackProps {
  existingApiId: string | undefined,
  prefix: string
  rootResourceId: string | undefined,
  stage: string
  vpcId: string
  environment: {
    CMR_BASE_URL: string
    EDL_PASSWORD: string
    RDF4J_PASSWORD: string
    RDF4J_SERVICE_URL: string
    RDF4J_USER_NAME: string
    RDF_BUCKET_NAME: string
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
      environment,
      existingApiId,
      prefix,
      rootResourceId,
      stage,
      vpcId
    } = props
    this.stage = stage

    // Set up VPC and Security Group
    const vpcSetup = new VpcSetup(this, 'VpcSetup', vpcId)
    this.vpc = vpcSetup.vpc
    this.securityGroup = vpcSetup.securityGroup

    // Set up IAM roles
    const iamSetup = new IamSetup(this, 'IamSetup', this.stage, this.account, this.region, this.stackName)
    this.lambdaRole = iamSetup.lambdaRole

    if (existingApiId && rootResourceId) {
      // Import existing API Gateway
      this.api = apigateway.RestApi.fromRestApiAttributes(this, 'ApiGatewayRestApi', {
        restApiId: existingApiId,
        rootResourceId
      })
    } else {
      // Create a new API Gateway
      this.api = new apigateway.RestApi(this, 'ApiGatewayRestApi', {
        restApiName: `${prefix}-api`,
        description: 'API Gateway for KMS',
        endpointTypes: [apigateway.EndpointType.PRIVATE],
        deploy: true,
        deployOptions: {
          stageName: stage
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
      vpc: this.vpc
    })

    const lambdas = this.lambdaFunctions.getAllLambdas()

    // Create a new deployment
    const deployment = new apigateway.Deployment(this, `ApiDeployment-${Date.now().toString()}`, {
      api: this.api,
      retainDeployments: false,
      description: `Deployment for ${stage} at ${new Date().toISOString()}`
    })

    // Ensure deployment happens after all routes/methods/integrations exist
    if (lambdas) {
      Object.values(lambdas).forEach((lambda) => {
        deployment.node.addDependency(lambda)
      })
    }

    // Add explicit dependencies
    this.api.deploymentStage?.node.addDependency(deployment)

    // Output the new deployment ID
    new cdk.CfnOutput(this, 'NewDeploymentId', {
      value: deployment.deploymentId,
      description: 'ID of the new API Gateway deployment',
      exportName: `${prefix}-NewApiDeploymentId`
    })

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
      description: 'Role used to execute commands across the serverless application',
      exportName: `${this.stage}-KMSServerlessCdkAppRole`,
      value: this.lambdaRole.roleArn
    })
  }
}
