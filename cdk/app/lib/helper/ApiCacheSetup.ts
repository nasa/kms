import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

/**
 * Helper class to configure API Gateway caching for multiple endpoints
 */
export class ApiCacheSetup {
  public static cacheMethodOptions(
    cacheTtl: cdk.Duration
  ): { [path: string]: apigateway.MethodDeploymentOptions } {
    const cachePaths = [
      '/concepts/GET',
      '/concepts/concept_scheme/{conceptScheme}/GET',
      '/concepts/concept_scheme/{conceptScheme}/pattern/{pattern}/GET',
      '/concepts/pattern/{pattern}/GET'
    ]

    return Object.fromEntries(
      cachePaths.map((path) => [
        path,
        {
          cachingEnabled: true,
          cacheTtl
        }
      ])
    ) as { [path: string]: apigateway.MethodDeploymentOptions }
  }

  /**
   * Configures method request, integration request, and caching for specified endpoints
   * @param scope - The construct scope
   * @param api - The API Gateway REST API
   * @param deployment - The API Gateway deployment
   * @param stageName - The stage name
   */
  public static configure(
    _scope: Construct,
    api: apigateway.IRestApi
  ): void {
    // Define query parameters for caching
    const queryParams = {
      'method.request.querystring.page_num': false,
      'method.request.querystring.page_size': false,
      'method.request.querystring.format': false,
      'method.request.querystring.version': false
    }

    const cacheKeyParameters = [
      'method.request.querystring.page_num',
      'method.request.querystring.page_size',
      'method.request.querystring.format',
      'method.request.querystring.version'
    ]

    // Helper to configure a single resource
    const configureResource = (
      resourcePath: string[],
      cacheNamespace: string
    ) => {
      const resource = resourcePath.reduce((acc, part) => {
        const child = acc.getResource(part)

        return child || acc
      }, api.root)

      if (!resourcePath.every((part) => resource.path.includes(part))) {
        return
      }

      const getMethod = resource.node.findChild('GET') as apigateway.Method
      if (getMethod) {
        const cfnMethod = getMethod.node.defaultChild as apigateway.CfnMethod
        cfnMethod.requestParameters = queryParams

        const existingIntegration = cfnMethod.integration as
          apigateway.CfnMethod.IntegrationProperty
        if (existingIntegration) {
          /* eslint-disable max-len */
          cfnMethod.integration = {
            type: existingIntegration.type,
            uri: existingIntegration.uri,
            integrationHttpMethod: existingIntegration.integrationHttpMethod,
            cacheNamespace,
            cacheKeyParameters,
            ...(existingIntegration.credentials && {
              credentials: existingIntegration.credentials
            }),
            ...(existingIntegration.requestTemplates && {
              requestTemplates: existingIntegration.requestTemplates
            }),
            ...(existingIntegration.integrationResponses && {
              integrationResponses: existingIntegration.integrationResponses
            }),
            ...(existingIntegration.passthroughBehavior && {
              passthroughBehavior: existingIntegration.passthroughBehavior
            }),
            ...(existingIntegration.connectionId && {
              connectionId: existingIntegration.connectionId
            }),
            ...(existingIntegration.connectionType && {
              connectionType: existingIntegration.connectionType
            }),
            ...(existingIntegration.contentHandling && {
              contentHandling: existingIntegration.contentHandling
            }),
            ...(existingIntegration.timeoutInMillis && {
              timeoutInMillis: existingIntegration.timeoutInMillis
            })
          }
          /* eslint-enable max-len */
        }
      }
    }

    // Configure method and integration request for all endpoints
    configureResource(['concepts'], 'concepts')
    configureResource(
      ['concepts', 'concept_scheme', '{conceptScheme}'],
      'concepts-scheme'
    )

    configureResource([
      'concepts',
      'concept_scheme',
      '{conceptScheme}',
      'pattern',
      '{pattern}'
    ], 'concepts-scheme-pattern')

    configureResource(['concepts', 'pattern', '{pattern}'], 'concepts-pattern')
  }
}
