import {
  CfnOutput,
  Duration,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

export interface ILoadBalancerStack {
  alb: elbv2.ApplicationLoadBalancer;
  targetGroup: elbv2.ApplicationTargetGroup;
  loadBalancerSecurityGroup: ec2.SecurityGroup;
}

interface LoadBalancerStackProps extends StackProps {
  vpcId: string;
}

/**
 * Stack for creating Load Balancer resources for RDF4J.
 * Technically, we don't really need a load balancer since we are
 * not scaling horizontally. But having one provides a static DNS
 * endpoint that doesn't change even if the underlying container or
 * EC2 instance changes. Also it can provide HTTPs (not implemented
 * yet) as add an additional security layer, as well as health
 * checks.
 */
export class LoadBalancerStack extends Stack implements ILoadBalancerStack {
  public alb!: elbv2.ApplicationLoadBalancer

  public rdf4jServiceUrl!: string

  public targetGroup!: elbv2.ApplicationTargetGroup

  public loadBalancerSecurityGroup!: ec2.SecurityGroup

  private vpc: ec2.IVpc

  constructor(scope: Construct, id: string, props: LoadBalancerStackProps) {
    super(scope, id, props)
    const { vpcId } = props
    console.log('creating load balancer stack')

    this.vpc = ec2.Vpc.fromLookup(this, 'VPC', {
      vpcId,
      isDefault: false,
      region: Stack.of(this).region
    })

    console.log('VPC lookup successful:', JSON.stringify({
      vpcId: this.vpc.vpcId,
      availabilityZones: this.vpc.availabilityZones,
      isolatedSubnets: this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId),
      publicSubnets: this.vpc.publicSubnets.map((subnet) => subnet.subnetId)
    }, null, 2))

    this.createLoadBalancer()
  }

  private createLoadBalancer(): void {
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
        interval: Duration.seconds(30)
      }
    })

    this.alb.addListener('Listener', {
      port: 8080,
      defaultTargetGroups: [this.targetGroup]
    })

    const rdf4jServiceUrl = `http://${this.alb.loadBalancerDnsName}:8080`
    this.rdf4jServiceUrl = rdf4jServiceUrl

    // Outputs
    this.addOutputs()
  }

  private addOutputs(): void {
    // eslint-disable-next-line no-new
    new CfnOutput(this, 'LoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'DNS name of the Application Load Balancer',
      exportName: 'rdf4jLoadBalancerDNS'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroup.targetGroupArn,
      description: 'ARN of the Target Group',
      exportName: 'rdf4jTargetGroupArn'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'LoadBalancerSecurityGroupId', {
      value: this.loadBalancerSecurityGroup.securityGroupId,
      description: 'ID of the Load Balancer Security Group',
      exportName: 'rdf4jLoadBalancerSecurityGroupId'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'RDF4JServiceUrl', {
      value: `http://${this.alb.loadBalancerDnsName}:8080`,
      description: 'URL of the RDF4J service',
      exportName: 'rdf4jServiceUrl'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'VPCStructure', {
      value: JSON.stringify({
        vpcId: this.vpc.vpcId,
        availabilityZones: this.vpc.availabilityZones,
        isolatedSubnets: this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId),
        publicSubnets: this.vpc.publicSubnets.map((subnet) => subnet.subnetId)
      }),
      description: 'VPC Structure'
    })
  }
}
