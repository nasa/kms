import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import { Construct } from 'constructs'

/**
 * Configuration properties for {@link RedisStack}.
 */
export interface RedisStackProps extends cdk.StackProps {
  /** Prefix used for resource naming and exported outputs. */
  prefix: string
  /** Deployment stage name (for example, `dev`, `sit`, `prod`). */
  stage: string
  /** Existing VPC ID where Redis will be provisioned. */
  vpcId: string
  /** ElastiCache node type (for example, `cache.t3.micro`). */
  nodeType?: string
}

/**
 * Provisions a single-node Redis ElastiCache cluster for KMS response caching.
 *
 * This stack creates:
 * 1. A Redis security group that allows VPC-internal TCP/6379 access.
 * 2. A Redis subnet group from `PRIVATE_WITH_EGRESS` subnets in the target VPC.
 * 3. A Redis cache cluster and CloudFormation outputs for endpoint address/port.
 */
export class RedisStack extends cdk.Stack {
  /** DNS endpoint address for the Redis cluster. */
  public readonly endpointAddress: string

  /** Port exposed by the Redis cluster endpoint. */
  public readonly endpointPort: string

  /** CloudFormation output for Redis endpoint address. */
  public readonly redisEndpointAddressOutput: cdk.CfnOutput

  /** CloudFormation output for Redis endpoint port. */
  public readonly redisEndpointPortOutput: cdk.CfnOutput

  /**
   * Creates a Redis cache stack in an existing VPC.
   *
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Construct identifier.
   * @param {RedisStackProps} props - Stack configuration.
   * @throws {Error} When the target VPC has no `PRIVATE_WITH_EGRESS` subnets.
   */
  constructor(scope: Construct, id: string, props: RedisStackProps) {
    super(scope, id, props)

    const {
      prefix, stage, vpcId, nodeType
    } = props

    const vpc = ec2.Vpc.fromLookup(this, `${prefix}-RedisVpc`, {
      vpcId
    })

    const redisSubnets = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    }).subnets

    if (redisSubnets.length === 0) {
      throw new Error('No PRIVATE_WITH_EGRESS subnets found for Redis in the selected VPC.')
    }

    const redisSecurityGroup = new ec2.SecurityGroup(this, `${prefix}-RedisSecurityGroup`, {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for KMS Redis cache'
    })

    // Allow Redis access from workloads inside the VPC.
    redisSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow VPC internal access to Redis'
    )

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, `${prefix}-RedisSubnetGroup`, {
      cacheSubnetGroupName: `${prefix}-${stage}-redis-subnets`,
      description: 'Subnet group for KMS Redis cache',
      subnetIds: redisSubnets.map((subnet) => subnet.subnetId)
    })

    const redisCluster = new elasticache.CfnCacheCluster(this, `${prefix}-RedisCluster`, {
      cacheNodeType: nodeType || 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: `${prefix}-${stage}-redis`,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref
    })

    redisCluster.addDependency(redisSubnetGroup)

    this.endpointAddress = redisCluster.attrRedisEndpointAddress
    this.endpointPort = redisCluster.attrRedisEndpointPort

    this.redisEndpointAddressOutput = new cdk.CfnOutput(this, 'RedisEndpointAddress', {
      description: 'Redis endpoint address for KMS cache',
      exportName: `${prefix}-RedisEndpointAddress`,
      value: this.endpointAddress
    })

    this.redisEndpointPortOutput = new cdk.CfnOutput(this, 'RedisEndpointPort', {
      description: 'Redis endpoint port for KMS cache',
      exportName: `${prefix}-RedisEndpointPort`,
      value: this.endpointPort
    })
  }
}
