/* eslint-disable no-new */
const { Stack, CfnOutput } = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const iam = require('aws-cdk-lib/aws-iam')

class IamStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.role = this.createIAMRole()
    this.addManagedPolicies(this.role)
    this.addInlinePolicies(this.role)
    this.addEcsExecuteCommandPermissions(this.role)
    this.addCustomPolicy(this.role)
    this.addOutputs()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  createIAMRole() {
    return new iam.Role(this, 'rdf4jRole', {
      roleName: 'rdf4jRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
    })
  }

  addManagedPolicies(role) {
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
    )
  }

  addInlinePolicies(role) {
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite'],
      resources: [`arn:aws:elasticfilesystem:${this.region}:${this.account}:access-point/*`]
    }))
  }

  addEcsExecuteCommandPermissions(role) {
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ssmmessages:CreateControlChannel',
        'ssmmessages:CreateDataChannel',
        'ssmmessages:OpenControlChannel',
        'ssmmessages:OpenDataChannel',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:PutMetricFilter',
        'cloudwatch:PutMetricData'
      ],
      resources: ['*']
    }))
  }

  addCustomPolicy(role) {
    const policy = new iam.Policy(this, 'rdf4jRolePolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage'
          ],
          resources: ['*']
        }),
        // Add this new PolicyStatement for ECS permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ecs:DescribeServices',
            'ecs:UpdateService',
            'ecs:ListServices'
          ],
          resources: ['*']
        })
      ]
    })

    policy.attachToRole(role)
  }

  addOutputs() {
    new CfnOutput(this, 'RoleArn', {
      value: this.role.roleArn,
      exportName: 'rdf4jRoleArn'
    })
  }
}

module.exports = { IamStack }
