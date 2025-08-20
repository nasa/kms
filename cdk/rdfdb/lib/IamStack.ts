import {
  CfnOutput,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export interface IIamStack {
  readonly role: iam.Role;
}

interface IamStackProps extends StackProps {
  vpcId: string;
}

/**
 * Stack for creating IAM resources for RDF4J.
 */
export class IamStack extends Stack implements IIamStack {
  public readonly role: iam.Role

  private readonly vpc: ec2.IVpc

  constructor(scope: Construct, id: string, props: IamStackProps) {
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

  private getVpc(vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  private addSsmPermissions(role: iam.Role): void {
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))
  }

  private createIAMRole(): iam.Role {
    return new iam.Role(this, 'rdf4jRole', {
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
  }

  private addEbsVolumePermissions(role: iam.Role): void {
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

  private addAwsBackupPermissions(role: iam.Role): void {
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

  private addEcrAndElbPermissions(role: iam.Role): void {
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

  private addOutputs(): void {
    // eslint-disable-next-line no-new
    new CfnOutput(this, 'RoleArn', {
      value: this.role.roleArn,
      exportName: 'rdf4jRoleArn'
    })
  }
}
