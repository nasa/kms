/* eslint-disable no-new */
const {
  Stack, CfnOutput,
  Duration
} = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2')

/**
 * Stack for creating Load Balancer resources for RDF4J.
 * Technically, we don't really need a load balancer since we are
 * not scaling horizontally.   But having one provides a static DNS
 * endpoint that doesn't change even if the underlying container or
 * EC2 instance changes.   Also it can provide HTTPs (not implemented
 * yet) as add an additional security layer, as well as health
 * checks.
 * @extends Stack
 */
class LoadBalancerStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
    this.createLoadBalancer()
  }

  createLoadBalancer() {
    this.loadBalancerSecurityGroup = new ec2.SecurityGroup(this, 'LoadBalancerSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Load Balancer',
      allowAllOutbound: true
    })

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'rdf4jLoadBalancer', {
      vpc: this.vpc,
      internetFacing: false,
      securityGroup: this.loadBalancerSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: this.vpc.availabilityZones.slice(0, 2)
      }
    })

    // Create a base64 encoded string of the username and password
    const RDF4J_USER_NAME = process.env.RDF4J_USER_NAME || 'rdf4j'
    const RDF4J_PASSWORD = process.env.RDF4J_PASSWORD || 'rdf4j'

    const base64Auth = Buffer.from(`${RDF4J_USER_NAME}:${RDF4J_PASSWORD}`).toString('base64')

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'rdf4jTargetGroup', {
      vpc: this.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/rdf4j-server/protocol',
        port: '8080',
        healthyHttpCodes: '200,301,302',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 10,
        timeout: Duration.seconds(10),
        interval: Duration.seconds(30),
        headers: [
          {
            name: 'Authorization',
            value: `Basic ${base64Auth}`
          }
        ]
      }
    })

    this.alb.addListener('Listener', {
      port: 8080,
      defaultTargetGroups: [this.targetGroup]
    })

    // Outputs

    new CfnOutput(this, 'LoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'DNS name of the Application Load Balancer',
      exportName: 'rdf4jLoadBalancerDNS'
    })

    new CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroup.targetGroupArn,
      description: 'ARN of the Target Group',
      exportName: 'rdf4jTargetGroupArn'
    })

    new CfnOutput(this, 'LoadBalancerSecurityGroupId', {
      value: this.loadBalancerSecurityGroup.securityGroupId,
      description: 'ID of the Load Balancer Security Group',
      exportName: 'rdf4jLoadBalancerSecurityGroupId'
    })

    new CfnOutput(this, 'RDF4JServiceUrl', {
      value: `http://${this.alb.loadBalancerDnsName}:8080`,
      description: 'URL of the RDF4J service',
      exportName: 'rdf4jServiceUrl'
    })
  }
}
module.exports = { LoadBalancerStack }
