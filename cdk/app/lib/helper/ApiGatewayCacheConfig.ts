import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cr from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

export interface ApiGatewayCacheConfigProps {
  restApiId: string;
  stageName: string;
  cacheClusterSize?: string;
  resourcePath: string;
  cacheTtlInSeconds?: number;
  cacheKeyParameters?: string[];
}

export class ApiGatewayCacheConfig extends Construct {
  constructor(scope: Construct, id: string, props: ApiGatewayCacheConfigProps) {
    super(scope, id)

    const {
      restApiId,
      stageName,
      cacheClusterSize = '0.5',
      resourcePath,
      cacheTtlInSeconds = 300,
      cacheKeyParameters = []
    } = props

    // For API Gateway method settings, use /*/* pattern for paths with parameters
    // or full path for simple resources
    // Use full path for each resource, including path parameters
    const basePath = `/methodSettings/~1${resourcePath.replace(/\//g, '~1')}/GET`

    const patchOperations: unknown[] = [
      {
        op: 'replace',
        path: '/cacheClusterEnabled',
        value: 'true'
      },
      {
        op: 'replace',
        path: '/cacheClusterSize',
        value: cacheClusterSize
      },
      {
        op: 'replace',
        path: `${basePath}/caching/enabled`,
        value: 'true'
      },
      {
        op: 'replace',
        path: `${basePath}/caching/ttlInSeconds`,
        value: String(cacheTtlInSeconds)
      },
      ...cacheKeyParameters.map((param) => ({
        op: 'add',
        path: `${basePath}/caching/cacheKeyParameters/-`,
        value: param
      }))
    ]

    // eslint-disable-next-line no-new
    new cr.AwsCustomResource(this, 'Cache', {
      onCreate: {
        service: 'APIGateway',
        action: 'updateStage',
        parameters: {
          restApiId,
          stageName,
          patchOperations
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          `${restApiId}-cache-${id}`
        )
      },
      onUpdate: {
        service: 'APIGateway',
        action: 'updateStage',
        parameters: {
          restApiId,
          stageName,
          patchOperations
        }
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['apigateway:PATCH'],
          resources: [
            `arn:aws:apigateway:${cdk.Stack.of(this).region}::/restapis/${restApiId}/stages/${stageName}`
          ]
        })
      ])
    })
  }
}
