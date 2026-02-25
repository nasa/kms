/* eslint-disable no-new */
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

/**
 * Properties for the ApiResources class.
 * @interface ApiResourcesProps
 */
export interface ApiResourcesProps {
    /** The existing API Gateway to configure */
  api: apigateway.IRestApi;
  /** The prefix to use for naming resources */
  prefix: string;
}

/**
 * Configures API Gateway resources and responses for an existing API.
 * This class handles CORS configuration and gateway responses.
 */
export class ApiResources {
/** The referenced existing API Gateway */
  public readonly api: apigateway.IRestApi

  /** Array of allowed CORS headers */
  private readonly corsHeaders: string[]

  /** Set of resources that have already been processed for CORS */
  private processedResources: Set<string> = new Set()

  /**
   * Creates an instance of ApiResources.
   * @param {ApiResourcesProps} props - The properties to configure the ApiResources.
   */
  constructor(props: ApiResourcesProps) {
    const { api } = props
    this.api = api

    this.corsHeaders = [
      'Content-Type',
      'X-Amz-Date',
      'Authorization',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'Access-Control-Request-Headers',
      'Access-Control-Request-Methods'
    ]
  }

  private getCorsHeaderValues() {
    return {
      origin: process.env.CORS_ORIGIN as string,
      headers: this.corsHeaders.join(','),
      methods: 'GET,POST,PUT,DELETE,OPTIONS',
      credentials: 'true'
    }
  }

  /**
   * Configures CORS for the entire API.
   * This method sets up gateway responses and adds CORS options to the root resource.
   * @param {Construct} scope - The construct scope in which to define the CORS configuration.
   * @param {string} prefix - The prefix to use for naming gateway responses.
   */
  public configureCors(scope: Construct, prefix: string) {
    this.addGatewayResponses(scope, prefix)
  }

  /**
   * Gets the CORS headers for use in responses.
   * @returns {Object} An object containing the CORS headers.
   * @private
   */
  private getCorsHeaders() {
    const corsValues = this.getCorsHeaderValues()

    return {
      'Access-Control-Allow-Origin': `'${corsValues.origin}'`,
      'Access-Control-Allow-Headers': `'${corsValues.headers}'`,
      'Access-Control-Allow-Methods': `'${corsValues.methods}'`,
      'Access-Control-Allow-Credentials': `'${corsValues.credentials}'`
    }
  }

  /**
   * Adds gateway responses to the API with CORS headers.
   * @param {Construct} scope - The construct scope in which to define the responses.
   * @param {string} prefix - The prefix to use for naming the responses.
   * @private
   */
  private addGatewayResponses(scope: Construct, prefix: string) {
    const corsHeaders = this.getCorsHeaders()

    const responseTypes = [
      apigateway.ResponseType.DEFAULT_4XX,
      apigateway.ResponseType.DEFAULT_5XX,
      apigateway.ResponseType.UNAUTHORIZED,
      apigateway.ResponseType.ACCESS_DENIED,
      apigateway.ResponseType.RESOURCE_NOT_FOUND,
      apigateway.ResponseType.MISSING_AUTHENTICATION_TOKEN
    ]

    responseTypes.forEach((type) => {
      const typeName = type.responseType
      const constructId = `${prefix}${typeName}`

      if (type === apigateway.ResponseType.MISSING_AUTHENTICATION_TOKEN) {
        new apigateway.GatewayResponse(scope, constructId, {
          restApi: this.api,
          type,
          statusCode: '404',
          templates: {
            'application/json': JSON.stringify({
              message: 'Not Found: The requested resource could not be found.',
              path: '$context.path',
              resourcePath: '$context.resourcePath'
            })
          },
          responseHeaders: {
            ...corsHeaders,
            'Content-Type': "'application/json'"
          }
        })
      } else {
        new apigateway.GatewayResponse(scope, constructId, {
          restApi: this.api,
          type,
          responseHeaders: corsHeaders
        })
      }

      // Add CORS-specific gateway response
      new apigateway.GatewayResponse(this.api, `CORS_${typeName}`, {
        restApi: this.api,
        type,
        responseHeaders: corsHeaders
      })
    })
  }

  /**
   * Adds CORS options to a specific API resource.
   * This method creates an OPTIONS method for the given resource with the appropriate CORS headers.
   * @param {apigateway.IResource} resource - The API resource to add CORS options to.
   * @returns {apigateway.Method | undefined} The created OPTIONS method, or undefined if already processed.
   * @public
   */
  public addCorsOptionsToResource(resource: apigateway.IResource): apigateway.Method | undefined {
    console.log(`Attempting to add/update CORS options for resource: ${resource.path}`)

    if (this.processedResources.has(resource.path)) {
      console.log(`CORS options already processed for resource ${resource.path}. Skipping.`)

      return undefined
    }

    // Remove existing OPTIONS method if it exists
    const existingOptionsMethod = resource.node.tryFindChild('OPTIONS')
    if (existingOptionsMethod) {
      console.log(`Removing existing OPTIONS method for resource ${resource.path}`)
      resource.node.tryRemoveChild('OPTIONS')
    }

    // Add new OPTIONS method with explicit CORS configuration and integration
    const corsValues = this.getCorsHeaderValues()
    const optionsMethod = resource.addMethod(
      'OPTIONS',
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': `'${corsValues.headers}'`,
              'method.response.header.Access-Control-Allow-Methods': `'${corsValues.methods}'`,
              'method.response.header.Access-Control-Allow-Origin': `'${corsValues.origin}'`,
              'method.response.header.Access-Control-Allow-Credentials': `'${corsValues.credentials}'`
            }
          }
        ],
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': '{"statusCode": 200}'
        }
      }),
      {
        methodResponses: [
          {
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Methods': true,
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Credentials': true
            }
          }
        ]
      }
    )

    this.processedResources.add(resource.path)
    console.log(`CORS options processed for resource ${resource.path}`)

    return optionsMethod
  }
}
