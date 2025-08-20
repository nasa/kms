/* eslint-disable no-new */
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

/**
 * Interface for ApiGatewaySetup properties.
 * @interface
 */
export interface ApiGatewaySetupProps {
  /** The existing API Gateway to configure */
  api: apigateway.IRestApi;

  /** The prefix to use for naming resources, e.g., "kms" */
  prefix: string;
}

/**
 * Configures API Gateway responses for an existing API.
 */
export class ApiGatewaySetup {
/**
   * The referenced existing API Gateway
   * @public
   * @readonly
   */
  public readonly api: apigateway.IRestApi

  /**
   * Creates an instance of ApiGatewaySetup.
   * @param {Construct} scope - The scope in which to define this construct.
   * @param {string} id - The scoped construct ID.
   * @param {ApiGatewaySetupProps} props - Configuration properties.
   */
  constructor(scope: Construct, id: string, props: ApiGatewaySetupProps) {
    const {
      api,
      prefix
    } = props

    this.api = api

    this.addGatewayResponses(scope, prefix)
  }

  /**
   * Adds gateway responses to the API.
   * @private
   * @param {Construct} scope - The scope in which to define the responses.
   * @param {string} prefix - The prefix to use for naming the responses.
   */
  private addGatewayResponses(scope: Construct, prefix: string) {
    new apigateway.GatewayResponse(scope, `${prefix}Default4XX`, {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'"
      }
    })

    new apigateway.GatewayResponse(scope, `${prefix}Default5XX`, {
      restApi: this.api,
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'"
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
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Content-Type': "'application/json'"
      }
    })
  }
}
