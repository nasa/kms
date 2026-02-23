import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

/**
 * Helper class to configure API Gateway caching for multiple endpoints
 */
export class ApiCacheSetup {
  private static readonly conceptsMethodPaths = [
    '/concepts/GET',
    '/concepts/concept_scheme/{conceptScheme}/GET',
    '/concepts/concept_scheme/{conceptScheme}/pattern/{pattern}/GET',
    '/concepts/pattern/{pattern}/GET'
  ]

  public static cacheMethodOptions(
    cacheTtl: cdk.Duration
  ): { [path: string]: apigateway.MethodDeploymentOptions } {
    return Object.fromEntries(
      this.conceptsMethodPaths.map((path) => [
        path,
        {
          cachingEnabled: true,
          cacheTtl
        }
      ])
    ) as { [path: string]: apigateway.MethodDeploymentOptions }
  }

  public static throttleMethodOptions(
    throttlingRateLimit: number,
    throttlingBurstLimit: number
  ): { [path: string]: apigateway.MethodDeploymentOptions } {
    return Object.fromEntries(
      this.conceptsMethodPaths.map((path) => [
        path,
        {
          throttlingRateLimit,
          throttlingBurstLimit
        }
      ])
    ) as { [path: string]: apigateway.MethodDeploymentOptions }
  }

  public static mergeMethodOptions(
    ...options: Array<{ [path: string]: apigateway.MethodDeploymentOptions } | undefined>
  ): { [path: string]: apigateway.MethodDeploymentOptions } | undefined {
    const merged: { [path: string]: apigateway.MethodDeploymentOptions } = {}

    options.forEach((optionSet) => {
      if (!optionSet) return

      Object.entries(optionSet).forEach(([path, option]) => {
        merged[path] = {
          ...(merged[path] || {}),
          ...option
        }
      })
    })

    return Object.keys(merged).length ? merged : undefined
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

    const baseCacheKeyParameters = [
      'method.request.querystring.page_num',
      'method.request.querystring.page_size',
      'method.request.querystring.format',
      'method.request.querystring.version'
    ]

    // Helper to configure a single resource
    const configureResource = (
      resourcePath: string[],
      cacheNamespace: string,
      pathParams: string[] = []
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

        // Add path parameters to request parameters
        const pathRequestParams = pathParams.reduce((acc, param) => {
          acc[param] = true

          return acc
        }, {} as Record<string, boolean>)

        cfnMethod.requestParameters = {
          ...queryParams,
          ...pathRequestParams
        }

        const existingIntegration = cfnMethod.integration as
          apigateway.CfnMethod.IntegrationProperty
        if (existingIntegration) {
          // Combine base cache key parameters with path parameters for this resource
          const cacheKeyParameters = [...baseCacheKeyParameters, ...pathParams]

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
    configureResource(['concepts'], 'concepts', [])

    configureResource(
      ['concepts', 'concept_scheme', '{conceptScheme}'],
      'concepts-scheme',
      ['method.request.path.conceptScheme']
    )

    configureResource(
      ['concepts', 'concept_scheme', '{conceptScheme}', 'pattern', '{pattern}'],
      'concepts-scheme-pattern',
      ['method.request.path.conceptScheme', 'method.request.path.pattern']
    )

    configureResource(
      ['concepts', 'pattern', '{pattern}'],
      'concepts-pattern',
      ['method.request.path.pattern']
    )
  }
}
