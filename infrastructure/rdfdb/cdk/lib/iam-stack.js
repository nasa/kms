/* eslint-disable no-new */
const { Stack, CfnOutput } = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const iam = require('aws-cdk-lib/aws-iam')

/**
 * Stack for creating IAM resources for RDF4J.
 * @extends Stack
 */
class IamStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.role = this.createIAMRole()
    this.addEbsVolumePermissions(this.role)
    this.addEcrAndElbPermissions(this.role)
    this.addSsmPermissions(this.role)
    this.addAwsBackupPermissions(this.role)
    this.addOutputs()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  addSsmPermissions(role) {
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))
  }

  createIAMRole() {
    const role = new iam.Role(this, 'rdf4jRole', {
      roleName: 'rdf4jRole',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        new iam.ServicePrincipal('ec2.amazonaws.com'),
        new iam.ServicePrincipal('backup.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    })

    return role
  }

  addEbsVolumePermissions(role) {
    // Keep this method as is
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ec2:AttachVolume',
        'ec2:DetachVolume',
        'ec2:DescribeVolumes',
        'ec2:DescribeVolumeStatus',
        'ec2:DescribeVolumeAttribute',
        'ec2:DescribeVolumesModifications',
        'ec2:ModifyVolume'
      ],
      resources: ['*']
    }))
  }

  addAwsBackupPermissions(role) {
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'))
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForRestores'))

    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'backup:CreateBackupPlan',
        'backup:CreateBackupSelection',
        'backup:CreateBackupVault',
        'backup:DeleteBackupPlan',
        'backup:DeleteBackupSelection',
        'backup:DeleteBackupVault',
        'backup:DescribeBackupJob',
        'backup:DescribeBackupVault',
        'backup:DescribeProtectedResource',
        'backup:DescribeRecoveryPoint',
        'backup:GetBackupPlan',
        'backup:GetBackupSelection',
        'backup:ListBackupJobs',
        'backup:ListBackupPlans',
        'backup:ListBackupSelections',
        'backup:ListBackupVaults',
        'backup:ListProtectedResources',
        'backup:ListRecoveryPointsByBackupVault',
        'backup:ListRecoveryPointsByResource',
        'backup:ListTags',
        'backup:PutBackupVaultAccessPolicy',
        'backup:StartBackupJob',
        'backup:TagResource',
        'backup:UntagResource',
        'backup:UpdateBackupPlan'
      ],
      resources: ['*']
    }))
  }

  addEcrAndElbPermissions(role) {
    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'elasticloadbalancing:DeregisterInstancesFromLoadBalancer',
        'elasticloadbalancing:DeregisterTargets',
        'elasticloadbalancing:Describe*',
        'elasticloadbalancing:RegisterInstancesWithLoadBalancer',
        'elasticloadbalancing:RegisterTargets',
        'ec2:DescribeInstances',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*']
    }))
  }

  addOutputs() {
    new CfnOutput(this, 'RoleArn', {
      value: this.role.roleArn,
      exportName: 'rdf4jRoleArn'
    })
  }
}

module.exports = { IamStack }
