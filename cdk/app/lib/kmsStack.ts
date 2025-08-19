/* eslint-disable no-new */
import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

import { IamSetup } from './helper/iamSetup'
import { LambdaFunctions } from './helper/kmsLambdaFunctions'
import { VpcSetup } from './helper/vpcSetup'

/**
 * Interface for KmsStack properties.
 * @interface
 */
export interface KmsStackProps extends cdk.StackProps {
  prefix: string
  stage: string
  vpcId: string
  existingApiId: string | undefined,
  rootResourceId: string | undefined,
  environment: {
    RDF4J_SERVICE_URL: string
    RDF4J_USER_NAME: string
    RDF4J_PASSWORD: string
    CMR_BASE_URL: string
    EDL_PASSWORD: string
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
      prefix, stage, environment, vpcId, existingApiId, rootResourceId
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
        deployOptions: {
          stageName: stage
        },
        policy: iamSetup.createApiGatewayPolicy()
      })
    }

    // Set up Lambda functions
    this.lambdaFunctions = new LambdaFunctions(this, {
      prefix,
      stage: this.stage,
      vpc: this.vpc,
      securityGroup: this.securityGroup,
      lambdaRole: this.lambdaRole,
      api: this.api,
      environment
    })

    const lambdas = this.lambdaFunctions.getAllLambdas()

    // This will work for both existing and new APIs
    const deployment = new apigateway.CfnDeployment(this, 'ApiDeployment', {
      restApiId: this.api.restApiId,
      stageName: stage,
      description: `Deployment for ${stage} at ${new Date().toISOString()}`
    })

    // Ensure deployment happens after all routes/methods/integrations exist
    if (lambdas) {
      Object.values(lambdas).forEach((lambda) => {
        deployment?.node.addDependency(lambda)
      })
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
      value: this.api.restApiRootResourceId,
      description: 'The ID of the API Gateway root resource',
      exportName: `${prefix}-KmsApiRootResourceId`
    })

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: apiUrl,
      description: 'The URL of the API Gateway',
      exportName: `${prefix}-KmsApiGatewayUrl`
    })

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'The ID of the API Gateway',
      exportName: `${prefix}-KmsApiId`
    })

    new cdk.CfnOutput(this, 'AuthorizerId', {
      value: this.lambdaFunctions.authorizer.authorizerId,
      description: 'The ID of the API Gateway Authorizer',
      exportName: `${prefix}-KmsAuthorizerId`
    })

    new cdk.CfnOutput(this, 'KMSLambdaSecurityGroup', {
      value: this.securityGroup.securityGroupId,
      exportName: `${this.stage}-kms-LambdaSecurityGroup`
    })

    new cdk.CfnOutput(this, 'KMSServerlessAppRoleArn', {
      value: this.lambdaRole.roleArn,
      description: 'Role used to execute commands across the serverless application',
      exportName: `${this.stage}-KMSServerlessCdkAppRole`
    })
  }
}
