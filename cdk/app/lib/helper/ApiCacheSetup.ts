import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import { Construct } from 'constructs'

import { ApiGatewayCacheConfig } from './ApiGatewayCacheConfig'

/**
 * Helper class to configure API Gateway caching for multiple endpoints
 */
export class ApiCacheSetup {
  /**
   * Configures method request, integration request, and caching for specified endpoints
   * @param scope - The construct scope
   * @param api - The API Gateway REST API
   * @param deployment - The API Gateway deployment
   * @param stageName - The stage name
   */
  public static configure(
    scope: Construct,
    api: apigateway.IRestApi,
    deployment: apigateway.Deployment,
    stageName: string
  ): void {
    // Define query parameters for caching
    const queryParams = {
      'method.request.querystring.page_num': false,
      'method.request.querystring.page_size': false,
      'method.request.querystring.format': false,
      'method.request.querystring.version': false
    }

    const integrationParams = {
      'integration.request.querystring.page_num':
        'method.request.querystring.page_num',
      'integration.request.querystring.page_size':
        'method.request.querystring.page_size',
      'integration.request.querystring.format':
        'method.request.querystring.format',
      'integration.request.querystring.version':
        'method.request.querystring.version'
    }

    const cacheKeyParameters = [
      'method.request.querystring.page_num',
      'method.request.querystring.page_size',
      'method.request.querystring.format',
      'method.request.querystring.version'
    ]

    // Helper to configure a single resource
    // eslint-disable-next-line max-len
    const configureResource = (resourcePath: string[], cacheNamespace: string) => {
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

        const existingIntegration = cfnMethod.integration as apigateway.CfnMethod.IntegrationProperty
        if (existingIntegration) {
          /* eslint-disable max-len */
          cfnMethod.integration = {
            type: existingIntegration.type,
            uri: existingIntegration.uri,
            integrationHttpMethod: existingIntegration.integrationHttpMethod,
            requestParameters: integrationParams,
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
    configureResource(['concepts', 'concept_scheme', '{conceptScheme}'], 'concepts-scheme')
    configureResource([
      'concepts',
      'concept_scheme',
      '{conceptScheme}',
      'pattern',
      '{pattern}'
    ], 'concepts-scheme-pattern')

    configureResource(['concepts', 'pattern', '{pattern}'], 'concepts-pattern')

    // Configure caching for all endpoints
    const cacheConfig = {
      restApiId: api.restApiId,
      stageName,
      cacheClusterSize: '0.5',
      cacheTtlInSeconds: 3600,
      cacheKeyParameters
    }

    // Create cache configurations for each endpoint
    const endpoints = [
      {
        id: 'ConceptsCache',
        path: 'concepts'
      },
      {
        id: 'ConceptsSchemeCache',
        path: 'concepts/concept_scheme/{conceptScheme}'
      },
      {
        id: 'ConceptsSchemePatternCache',
        path: 'concepts/concept_scheme/{conceptScheme}/pattern/{pattern}'
      },
      {
        id: 'ConceptsPatternCache',
        path: 'concepts/pattern/{pattern}'
      }
    ]

    endpoints.forEach((endpoint) => {
      const cache = new ApiGatewayCacheConfig(scope, endpoint.id, {
        ...cacheConfig,
        resourcePath: endpoint.path
      })
      cache.node.addDependency(deployment)
    })
  }
}
