import * as path from 'path'

import { Duration } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'

import { ApiResources } from './ApiResources'

/**
 * Interface for LambdaFunctions constructor properties
 */
interface LambdaFunctionsProps {
  api: apigateway.IRestApi;
  apiResources: ApiResources;
  lambdaRole: iam.Role;
  prefix: string;
  securityGroup: ec2.SecurityGroup;
  stage: string;
  vpc: ec2.IVpc;
  useLocalstack: boolean;
  environment: {
    CMR_BASE_URL: string;
    EDL_PASSWORD: string;
    RDF4J_PASSWORD: string;
    RDF4J_SERVICE_URL: string;
    RDF4J_USER_NAME: string;
    RDF_BUCKET_NAME: string,
  };
}

/**
 * Class for managing Lambda functions and their API Gateway integrations
 */
export class LambdaFunctions {
  /** API Gateway authorizer */
  public authorizer: apigateway.IAuthorizer

  /** Lambda function used as the API Gateway authorizer */
  public authorizerLambda: lambda.Function

  /** Map of Lambda functions, keyed by handler path */
  private lambdas: { [key: string]: lambda.Function } = {}

  /** Flag if use local stack */
  private useLocalstack: boolean

  /**
   * Constructs a new instance of LambdaFunctions
   * @param {Construct} scope - The scope in which to define this construct
   * @param {LambdaFunctionsProps} props - The properties for configuring the Lambda functions
   */
  constructor(scope: Construct, private props: LambdaFunctionsProps) {
    const { useLocalstack } = props
    this.useLocalstack = useLocalstack
    this.authorizerLambda = this.createAuthorizerLambda(scope)
    this.authorizer = this.createAuthorizer(scope, this.authorizerLambda)

    this.createApiLambdas(scope)
  }

  /**
   * Creates an API Gateway authorizer
   * @param {Construct} scope - The scope in which to define this construct
   * @param {lambda.Function} authorizerLambda - The Lambda function to use as the authorizer
   * @returns {apigateway.IAuthorizer} The created API Gateway authorizer
   * @private
   */
  private createAuthorizer(
    scope: Construct,
    authorizerLambda: lambda.Function
  ): apigateway.IAuthorizer {
    if (this.useLocalstack) {
      // Return a dummy authorizer for Localstack
      return {
        authorizerId: 'dummy-authorizer-id',
        authorizationType: apigateway.AuthorizationType.CUSTOM
      } as apigateway.IAuthorizer
    }

    const authorizer = new apigateway.TokenAuthorizer(scope, `${this.props.prefix}-EdlAuthorizer`, {
      handler: authorizerLambda,
      identitySource: apigateway.IdentitySource.header('Authorization')
    })

    return authorizer
  }

  /**
   * Creates the Lambda function to be used as the API Gateway authorizer
   * @param {Construct} scope - The scope in which to define this construct
   * @returns {lambda.Function} The created Lambda function
   * @private
   */
  private createAuthorizerLambda(scope: Construct): lambda.Function {
    return this.createLambdaFunction(
      scope,
      'edlAuthorizer/handler.js',
      'edl-authorizer',
      'edlAuthorizer',
      Duration.seconds(30),
      1024
    )
  }

  /**
   * Creates all API Lambda functions
   * @param {Construct} scope - The scope in which to define these constructs
   * @private
   */
  private createApiLambdas(scope: Construct) {
    this.createReadApiLambdas(scope)
    this.createTreeOperationApiLambdas(scope)
    this.createCrudOperationApiLambdas(scope)
    this.createExportRdfCrons(scope)
  }

  /**
   * Creates Lambda functions for read API operations
   * @param {Construct} scope - The scope in which to define these constructs
   * @private
   */
  private createReadApiLambdas(scope: Construct) {
    this.createApiLambda(
      scope,
      'getCapabilities/handler.js',
      'get-capabilities',
      'getCapabilities',
      '/',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcept/handler.js',
      'get-concept-by-alt-label',
      'getConcept',
      '/concept/alt_label/{altLabel}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcept/handler.js',
      'get-concept-by-short-name',
      'getConcept',
      '/concept/short_name/{shortName}',
      'GET'
    )

    // this.createApiLambda(
    //   scope,
    //   'getConcept/handler.js',
    //   'get-concept-by-full-path',
    //   'getConcept',
    //   '/concept/full_path/{fullPath+}',
    //   'GET'
    // )

    this.createApiLambda(
      scope,
      'getConcept/handler.js',
      'get-concept',
      'getConcept',
      '/concept/{conceptId}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcepts/handler.js',
      'get-concepts',
      'getConcepts',
      '/concepts',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcepts/handler.js',
      'get-concepts-by-pattern',
      'getConcepts',
      '/concepts/pattern/{pattern}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcepts/handler.js',
      'get-concepts-by-scheme',
      'getConcepts',
      '/concepts/concept_scheme/{conceptScheme}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcepts/handler.js',
      'get-concepts-by-scheme-and-pattern',
      'getConcepts',
      '/concepts/concept_scheme/{conceptScheme}/pattern/{pattern}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConcepts/handler.js',
      'get-concepts-root',
      'getConcepts',
      '/concepts/root',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConceptScheme/handler.js',
      'get-concept-scheme',
      'getConceptScheme',
      '/concept_scheme/{schemeId}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConceptSchemes/handler.js',
      'get-concept-schemes',
      'getConceptSchemes',
      '/concept_schemes',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConceptUpdatesReport/handler.js',
      'get-concept-updates-report',
      'getConceptUpdatesReport',
      '/concepts/operations/update_report',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getConceptVersions/handler.js',
      'get-concept-versions',
      'getConceptVersions',
      '/concept_versions/version_type/{versionType}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getFullPath/handler.js',
      'get-full-path',
      'getFullPath',
      '/concept_fullpaths/concept_uuid/{conceptId}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getKeywordFullPathHistory/handler.js',
      'get-keyword-full-path-history',
      'getKeywordFullPathHistory',
      '/keyword_version_report/{uuid}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'status/handler.js',
      'status',
      'status',
      '/status',
      'GET'
    )
  }

  /**
   * Creates Lambda functions for tree operation APIs
   * @param {Construct} scope - The scope in which to define these constructs
   * @private
   */
  private createTreeOperationApiLambdas(scope: Construct) {
    this.createApiLambda(
      scope,
      'getKeywordsTree/handler.js',
      'get-keywords-tree',
      'getKeywordsTree',
      '/tree/concept_scheme/{conceptScheme}',
      'GET'
    )

    this.createApiLambda(
      scope,
      'getKeyword/handler.js',
      'get-keyword',
      'getKeyword',
      '/keyword/{conceptId}',
      'GET'
    )
  }

  /**
   * Creates Lambda functions for CRUD operation APIs
   * @param {Construct} scope - The scope in which to define these constructs
   * @private
   */
  private createCrudOperationApiLambdas(scope: Construct) {
    this.createApiLambda(
      scope,
      'createConcept/handler.js',
      'create-concept',
      'createConcept',
      '/concept',
      'POST',
      true
    )

    this.createApiLambda(
      scope,
      'deleteConcept/handler.js',
      'delete-concept',
      'deleteConcept',
      '/concept/{conceptId}',
      'DELETE',
      true
    )

    this.createApiLambda(
      scope,
      'updateConcept/handler.js',
      'update-concept',
      'updateConcept',
      '/concept',
      'PUT',
      true
    )

    this.createApiLambda(
      scope,
      'publish/handler.js',
      'publish',
      'publish',
      '/publish',
      'POST',
      true
    )

    this.createApiLambda(
      scope,
      'createConceptScheme/handler.js',
      'create-concept-scheme',
      'createConceptScheme',
      '/concept_scheme',
      'POST',
      true
    )

    this.createApiLambda(
      scope,
      'deleteConceptScheme/handler.js',
      'delete-concept-scheme',
      'deleteConceptScheme',
      '/concept_scheme/{schemeId}',
      'DELETE',
      true
    )

    this.createApiLambda(
      scope,
      'updateConceptScheme/handler.js',
      'update-concept-scheme',
      'updateConceptScheme',
      '/concept_scheme',
      'PUT',
      true
    )
  }

  /**
   * Creates Lambda function for exporting RDF to S3 and sets up associated cron jobs
   * @param {Construct} scope - The scope in which to define these constructs
   * @private
   */
  private createExportRdfCrons(scope: Construct) {
    // Create the exportRdfToS3 Lambda
    const exportRdfToS3Lambda = this.createApiLambda(
      scope,
      'exportRdfToS3/handler.js',
      'export-rdf-to-s3',
      'handler',
      '/export-rdf',
      'POST',
      false,
      Duration.minutes(15)
    )

    // Set up cron jobs for exportRdfToS3
    // Runs at 1am nightly.
    this.setupCronJob(
      scope,
      exportRdfToS3Lambda,
      'cron(0 6 * * ? *)',
      { version: 'published' },
      'Published'
    )

    this.setupCronJob(
      scope,
      exportRdfToS3Lambda,
      'cron(5 6 * * ? *)',
      { version: 'draft' },
      'Draft'
    )
  }

  /**
   * Sets up a CloudWatch Events Rule to trigger a Lambda function on a schedule.
   *
   * @param {Construct} scope - The construct scope in which to create the CloudWatch Events Rule.
   * @param {lambda.Function} lambdaFunction - The Lambda function to be triggered by the cron job.
   * @param {string} cronExpression - The cron expression defining the schedule for the job.
   * @param {Object} input - The input to be passed to the Lambda function when triggered.
   * @param {('published'|'draft')} input[key] - The version of the data to be processed, either 'published' or 'draft'.
   * @private
   */
  private setupCronJob(
    scope: Construct,
    lambdaFunction: lambda.Function,
    cronExpression: string,
    input: { [key: string]: 'published' | 'draft' },
    ruleSuffix: string
  ) {
    const ruleId = `${this.props.prefix}-${lambdaFunction.node.id}-${ruleSuffix}-CronRule`
    const rule = new events.Rule(scope, ruleId, {
      schedule: events.Schedule.expression(cronExpression)
    })

    rule.addTarget(new targets.LambdaFunction(lambdaFunction, {
      event: events.RuleTargetInput.fromObject(input)
    }))
  }

  /**
   * Creates a Lambda function
   * @param {Construct} scope - The scope in which to define this construct
   * @param {string} handlerPath - The path to the Lambda handler file
   * @param {string} functionName - The name of the Lambda function
   * @param {string} handlerName - The name of the handler function within the file
   * @returns {lambda.Function} The created Lambda function
   * @private
   */
  private createLambdaFunction(
    scope: Construct,
    handlerPath: string,
    functionName: string,
    handlerName: string,
    timeout: Duration,
    memorySize: number
  ): lambda.Function {
    let lambdaFunction = this.lambdas[handlerPath]
    if (!lambdaFunction) {
      const nodejsFunctionProps: NodejsFunctionProps = {
        functionName: `${this.props.prefix}-${functionName}`,
        entry: path.join(__dirname, '../../../../serverless/src', handlerPath),
        handler: handlerName,
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout,
        memorySize,
        role: this.props.lambdaRole,
        depsLockFilePath: path.join(__dirname, '../../../../package-lock.json'),
        projectRoot: path.join(__dirname, '../../../..'),
        environment: this.props.environment,
        // Conditionally add VPC configuration
        ...(this.useLocalstack ? {} : {
          vpc: this.props.vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
          },
          securityGroups: [this.props.securityGroup]
        })
      }

      lambdaFunction = new NodejsFunction(scope, `${this.props.prefix}-${functionName}`, nodejsFunctionProps)

      this.lambdas[handlerPath] = lambdaFunction
    }

    return lambdaFunction
  }

  private createApiLambda(
    scope: Construct,
    handlerPath: string,
    functionName: string,
    handlerName: string,
    resourcePath: string,
    httpMethod: string,
    useAuthorizer: boolean = false,
    timeout: Duration = Duration.seconds(30),
    memorySize: number = 1024

  ) {
    const lambdaFunction = this.createLambdaFunction(
      scope,
      handlerPath,
      functionName,
      handlerName,
      timeout,
      memorySize
    )

    let resource = this.props.api.root
    if (resourcePath !== '/') {
      const pathParts = resourcePath.split('/').filter((p) => p)
      pathParts.forEach((part) => {
        resource = resource.getResource(part) || resource.addResource(part)
      })
    }

    const integrationOptions: apigateway.LambdaIntegrationOptions = {
      proxy: true
    }

    let methodOptions: apigateway.MethodOptions = {}

    if (!this.useLocalstack) {
      if (useAuthorizer) {
        methodOptions = {
          authorizer: this.authorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM
        }
      }
    }

    resource.addMethod(
      httpMethod,
      new apigateway.LambdaIntegration(lambdaFunction, integrationOptions),
      methodOptions
    )

    // Add CORS options to this resource
    this.props.apiResources.addCorsOptionsToResource(resource)

    return lambdaFunction
  }

  /**
   * Retrieves a Lambda function by its handler path
   * @param {string} handlerPath - The path to the Lambda handler file
   * @returns {lambda.Function | undefined} The Lambda function if found, undefined otherwise
   */

  public getLambda(handlerPath: string): lambda.Function {
    const lambdaFunction = this.lambdas[handlerPath]
    if (!lambdaFunction) {
      if (!handlerPath) {
        throw new Error(`Lambda function '${handlerPath}' not found`)
      }
    }

    return lambdaFunction
  }

  /**
   * Retrieves all Lambda functions
   * @returns {{ [handlerPath: string]: lambda.Function }} An object containing all Lambda functions, keyed by handler path
   */
  public getAllLambdas(): { [handlerPath: string]: lambda.Function } {
    return this.lambdas
  }

  /**
   * Retrieves a Lambda function by its function name
   * @param {string} functionName - The name of the Lambda function
   * @returns {lambda.Function | undefined} The Lambda function if found, undefined otherwise
   */
  public getLambdaByFunctionName(functionName: string): lambda.Function | undefined {
    const handlerPath = Object.keys(this.lambdas).find((handlerKey) => this.lambdas[handlerKey].functionName === `${this.props.prefix}-${functionName}`)

    return handlerPath ? this.lambdas[handlerPath] : undefined
  }
}
