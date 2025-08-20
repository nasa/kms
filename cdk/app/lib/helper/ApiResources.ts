/* eslint-disable no-new */
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

/**
 * Interface for ApiResources properties.
 * @interface
 */
export interface ApiResourcesProps {
 /** The existing API Gateway to configure */
  api: apigateway.IRestApi;

  /** The CORS origin to allow */
  corsOrigin: string;

  /** The prefix to use for naming resources, e.g., "kms" */
  prefix: string;
}

/**
 * Configures API Gateway resources and responses for an existing API.
 * This class handles CORS configuration and gateway responses.
 */
export class ApiResources {
/**
   * The referenced existing API Gateway
   * @public
   * @readonly
   */
  public readonly api: apigateway.IRestApi

  /** Array of allowed CORS origins */
  private readonly corsOrigins: string[]

  /** Array of allowed CORS headers */
  private readonly corsHeaders: string[]

  private processedResources: Set<string> = new Set()

  /**
 * Configures API Gateway resources and responses for an existing API.
 * This class handles CORS configuration and gateway responses.
 */
  constructor(props: ApiResourcesProps) {
    const { api, corsOrigin } = props
    this.api = api

    const defaultCorsOrigins = ['*.earthdata.nasa.gov', 'http://localhost:5173']
    const additionalCorsOrigins = corsOrigin.split(',')
    this.corsOrigins = [...new Set([...defaultCorsOrigins, ...additionalCorsOrigins])]

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

  /**
   * Adds gateway responses to the API.
   * @param {Construct} scope - The scope in which to define the responses
   * @param {string} prefix - The prefix to use for naming the responses
   * @private
   */
  public addGatewayResponses(scope: Construct, prefix: string) {
    new apigateway.GatewayResponse(scope, `${prefix}Default4XX`, {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${this.corsOrigins.join(',')}'`,
        'Access-Control-Allow-Headers': `'${this.corsHeaders.join(',')}'`
      }
    })

    new apigateway.GatewayResponse(scope, `${prefix}Default5XX`, {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${this.corsOrigins.join(',')}'`,
        'Access-Control-Allow-Headers': `'${this.corsHeaders.join(',')}'`
      }
    })

    new apigateway.GatewayResponse(scope, `${prefix}MissingAuthToken`, {
      restApi: this.api,
      type: apigateway.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      statusCode: '404',
      templates: {
        'application/json': JSON.stringify({
          message: 'Not Found: The requested resource could not be found.',
          path: '$context.path',
          resourcePath: '$context.resourcePath'
        })
      },
      responseHeaders: {
        'Access-Control-Allow-Origin': `'${this.corsOrigins.join(',')}'`,
        'Access-Control-Allow-Headers': `'${this.corsHeaders.join(',')}'`,
        'Content-Type': "'application/json'"
      }
    })
  }

  /**
   * Configures CORS (Cross-Origin Resource Sharing) for the entire API.
   * This method sets up gateway responses and adds CORS options to the root resource.
   *
   * @param {Construct} scope - The construct scope in which to define the CORS configuration.
   * @param {string} prefix - The prefix to use for naming gateway responses.
   *
   * @description
   * This method performs two main tasks:
   * 1. Adds gateway responses with CORS headers for 4XX, 5XX, and MissingAuthToken errors.
   * 2. Adds CORS preflight options to the root resource of the API.
   *
   * It should be called once during the API setup to ensure proper CORS configuration.
   *
   * @example
   * const apiResources = new ApiResources({ ... });
   * apiResources.configureCors(this, 'myApi');
   */
  public configureCors(scope: Construct, prefix: string) {
    this.addGatewayResponses(scope, prefix)
    this.addCorsOptionsToRoot()
  }

  /**
   * Configures CORS for the entire API.
   * This method sets up gateway responses and adds CORS options to the root resource.
   * @param {Construct} scope - The scope in which to define the responses
   * @param {string} prefix - The prefix to use for naming the responses
   */
  private addCorsOptionsToRoot() {
    this.addCorsOptionsToResource(this.api.root)

    if (this.api instanceof apigateway.RestApi) {
      this.api.addGatewayResponse('CORS', {
        type: apigateway.ResponseType.DEFAULT_4XX,
        responseHeaders: {
          'Access-Control-Allow-Origin': `'${this.corsOrigins.join(',')}'`,
          'Access-Control-Allow-Headers': `'${this.corsHeaders.join(',')}'`,
          'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
          'Access-Control-Allow-Credentials': "'true'"
        }
      })
    } else {
      console.warn('Cannot add gateway response to imported API. CORS headers may need to be configured manually.')
    }
  }

  /**
   * Adds CORS options to a specific API resource.
   * This method creates an OPTIONS method for the given resource with the appropriate CORS headers.
   * @param {apigateway.IResource} resource - The API resource to add CORS options to
   */
  public addCorsOptionsToResource(resource: apigateway.IResource): void {
    // Check if this is the root resource and if it already has CORS options
    if (this.processedResources.has(resource.path)) {
      console.log(`CORS options already added for resource ${resource.path}. Skipping.`)

      return
    }

    const corsOptions: apigateway.CorsOptions = {
      allowOrigins: this.corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: this.corsHeaders,
      allowCredentials: true
    }

    // Mark this resource as processed
    this.processedResources.add(resource.path)
    // This will add or update the CORS options
    resource.addCorsPreflight(corsOptions)
  }
}
