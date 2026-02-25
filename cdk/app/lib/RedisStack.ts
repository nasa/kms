import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import { Construct } from 'constructs'

export interface RedisStackProps extends cdk.StackProps {
  prefix: string
  stage: string
  vpcId: string
  nodeType?: string
}

export class RedisStack extends cdk.Stack {
  public readonly endpointAddress: string

  public readonly endpointPort: string

  public readonly redisEndpointAddressOutput: cdk.CfnOutput

  public readonly redisEndpointPortOutput: cdk.CfnOutput

  constructor(scope: Construct, id: string, props: RedisStackProps) {
    super(scope, id, props)

    const {
      prefix, stage, vpcId, nodeType
    } = props

    const vpc = ec2.Vpc.fromLookup(this, `${prefix}-RedisVpc`, {
      vpcId
    })

    const preferredSubnets = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    }).subnets
    const fallbackSubnets = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED
    }).subnets
    const redisSubnets = preferredSubnets.length > 0 ? preferredSubnets : fallbackSubnets

    if (redisSubnets.length === 0) {
      throw new Error('No private subnets found for Redis. Add PRIVATE_WITH_EGRESS or PRIVATE_ISOLATED subnets.')
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
