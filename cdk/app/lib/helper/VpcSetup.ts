// Import { Fn } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

/**
 * Class for setting up VPC and Security Group for Lambda functions.
 */
export class VpcSetup {
  /**
   * The VPC instance.
   * @public
   */
  public vpc: ec2.IVpc

  /**
   * The Security Group for Lambda functions.
   * @public
   */
  public securityGroup: ec2.SecurityGroup

  /**
   * Creates an instance of VpcSetup.
   * @param {Construct} scope - The scope in which to define this construct.
   * @param {string} prefix - The prefix to use for naming resources.
   * @param {string} vpcId - The ID of the existing VPC to use.
   * @param {boolean} useLocalstack - Flag to indicate if LocalStack is being used for local development.
   */
  constructor(scope: Construct, prefix: string, vpcId: string, useLocalstack: boolean) {
    if (!useLocalstack) {
      // Look up the existing VPC
      this.vpc = ec2.Vpc.fromLookup(scope, `${prefix}-VPC`, { vpcId })
    } else {
      // Create a dummy VPC for local development
      this.vpc = ec2.Vpc.fromVpcAttributes(scope, `${prefix}-DummyVPC`, {
        vpcId: 'dummy-vpc-id',
        availabilityZones: ['dummy-az-1', 'dummy-az-2'],
        publicSubnetIds: ['dummy-subnet-1', 'dummy-subnet-2']
      })
    }

    // Create a Security Group (real or dummy)
    this.securityGroup = new ec2.SecurityGroup(scope, `${prefix}-LambdaSecurityGroup`, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: useLocalstack ? 'Dummy security group for local development' : 'Security group for KMS Lambda functions'
    })
  }
}
