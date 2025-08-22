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
   */
  constructor(scope: Construct, prefix: string, vpcId: string) {
    // Look up the existing VPC
    this.vpc = ec2.Vpc.fromLookup(scope, `${prefix}-VPC`, { vpcId })

    // Create a new Security Group for Lambda functions
    this.securityGroup = new ec2.SecurityGroup(scope, `${prefix}-LambdaSecurityGroup`, {
      vpc: this.vpc,
      description: 'Security Group for KMS Lambda functions',
      allowAllOutbound: true,
      securityGroupName: `${prefix}-lambda-sg`
    })
  }
}
