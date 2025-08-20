import * as fs from 'fs'
import * as path from 'path'

import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as custom from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

import { IEbsStack } from './ebs-stack'
import { ILoadBalancerStack } from './lb-stack'

interface EcsStackProps extends StackProps {
  vpcId: string;
  roleArn: string;
  ebsStack: IEbsStack;
  lbStack: ILoadBalancerStack;
}

/**
 * Stack for creating ECS (Elastic Container Service) resources for RDF4J.
 *
 * This stack sets up the necessary infrastructure to run RDF4J in an ECS cluster,
 * including:
 *
 * - An ECS cluster with EC2 instances
 * - An Auto Scaling Group for managing EC2 instances
 * - A task definition and service for running the RDF4J container
 * - Security groups and IAM roles for the ECS tasks
 * - An ECR repository for storing the RDF4J Docker image
 * - CloudWatch log groups for container logs
 * - Integration with an existing Application Load Balancer
 * - EBS volume mounting for persistent storage
 *
 * The stack also handles the creation and configuration of necessary networking
 * components and ensures that the ECS tasks are running in the same Availability
 * Zone as the EBS volume for data persistence.
 */
export class EcsStack extends Stack {
  private ebsStack: IEbsStack

  private vpc!: ec2.IVpc

  private role!: iam.IRole

  private ebsVolumeId!: string

  private ebsVolumeAz!: string

  private ecsTasksSecurityGroup!: ec2.SecurityGroup

  private repository!: ecr.IRepository

  private logGroup!: logs.LogGroup

  private cluster!: ecs.Cluster

  private taskDefinition!: ecs.Ec2TaskDefinition

  private loadBalancerDns!: string

  private targetGroupArn!: string

  private loadBalancerSecurityGroupId!: string

  private targetGroup!: elbv2.IApplicationTargetGroup

  private ecsService!: ecs.Ec2Service

  private capacityProvider!: ecs.AsgCapacityProvider

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props)
    const { vpcId, ebsStack } = props

    this.ebsStack = ebsStack
    this.initializeBaseResources(vpcId)
    this.addSecurityGroupRules()
    this.addOutputs()
  }

  private initializeBaseResources(vpcId: string): void {
    this.vpc = this.getVpc(vpcId)
    this.role = this.getRole()
    this.ebsVolumeId = this.getEbsVolumeId()
    this.ebsVolumeAz = this.getEbsVolumeAz()

    this.createSecurityGroups()
    this.repository = this.createOrGetECRRepository()
    this.logGroup = this.createLogGroup()
    this.cluster = this.createEcsCluster()
    this.taskDefinition = this.createTaskDefinition()
    const container = this.addContainerToTaskDefinition(this.taskDefinition)
    this.addEbsVolumeToTaskDefinition(this.taskDefinition)
    this.addMountPointToContainer(container)

    // Import Load Balancer resources
    this.loadBalancerDns = Fn.importValue('rdf4jLoadBalancerDNS')
    this.targetGroupArn = Fn.importValue('rdf4jTargetGroupArn')
    this.loadBalancerSecurityGroupId = Fn.importValue('rdf4jLoadBalancerSecurityGroupId')

    // Create the target group from the imported ARN
    this.targetGroup = elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(this, 'ImportedTargetGroup', {
      targetGroupArn: this.targetGroupArn
    })

    // Create ECS service
    this.createEcsService()
  }

  private createSecurityGroups(): void {
    this.ecsTasksSecurityGroup = new ec2.SecurityGroup(this, 'EcsTasksSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true
    })
  }

  private addSecurityGroupRules(): void {
    // Allow inbound traffic on port 8080 from anywhere to ECS tasks
    this.ecsTasksSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'Allow inbound traffic on port 8080 from anywhere'
    )

    // Allow traffic from Load Balancer to ECS tasks
    this.ecsTasksSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.loadBalancerSecurityGroupId),
      ec2.Port.tcp(8080),
      'Allow traffic from Load Balancer'
    )
  }

  private getVpc(vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  private getEbsVolumeId(): string {
    return this.ebsStack.volume.volumeId
  }

  private getEbsVolumeAz(): string {
    return this.ebsStack.volume.availabilityZone
  }

  private getRole(): iam.IRole {
    return iam.Role.fromRoleArn(this, 'ImportedRole', Fn.importValue('rdf4jRoleArn'))
  }

  private getInstanceType(): ec2.InstanceType {
    const instanceType = process.env.RDF4J_INSTANCE_TYPE || 'R5.LARGE'
    const [instanceClass, instanceSize] = instanceType.split('.')

    return ec2.InstanceType.of(
      ec2.InstanceClass[instanceClass as keyof typeof ec2.InstanceClass],
      ec2.InstanceSize[instanceSize as keyof typeof ec2.InstanceSize]
    )
  }

  private createEcsCluster(): ecs.Cluster {
    const { ebsVolumeId } = this

    const userData = ec2.UserData.forLinux()

    // Read the script from file
    const userDataScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'ebs-mount-script.sh'), 'utf8')

    // Replace the placeholder with the actual EBS volume ID
    // eslint-disable-next-line no-template-curly-in-string
    const scriptWithVolume = userDataScript.replace('${EBS_VOLUME_ID}', ebsVolumeId)
    userData.addCommands(scriptWithVolume)

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'rdf4jAutoScalingGroup', {
      instanceType: this.getInstanceType(),
      machineImage: ec2.MachineImage.fromSsmParameter('/ngap/amis/image_id_ecs_al2023_x86'),
      minCapacity: 1,
      maxCapacity: 1,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: [this.getEbsVolumeAz()]
      },
      userData,
      role: this.role
    })

    // Add a lifecycle hook to ensure instances are launched in the correct AZ
    autoScalingGroup.addLifecycleHook('EbsAzHook', {
      lifecycleTransition: autoscaling.LifecycleTransition.INSTANCE_LAUNCHING,
      defaultResult: autoscaling.DefaultResult.ABANDON,
      heartbeatTimeout: Duration.minutes(5),
      notificationMetadata: JSON.stringify({ targetAz: this.ebsVolumeAz })
    })

    // Add the security groups of the VPC endpoints to the Auto Scaling Group
    const cluster = new ecs.Cluster(this, 'rdf4jEcsCluster', {
      vpc: this.vpc,
      clusterName: 'rdf4jEcs'
    })
    // Add the security group to the cluster's default capacity provider
    cluster.connections.addSecurityGroup(this.ecsTasksSecurityGroup)

    this.capacityProvider = new ecs.AsgCapacityProvider(this, 'rdf4jAsgCapacityProvider', {
      autoScalingGroup,
      enableManagedTerminationProtection: false // Maybe remove.
    })

    cluster.addAsgCapacityProvider(this.capacityProvider)

    return cluster
  }

  private createOrGetECRRepository(): ecr.IRepository {
    const repositoryName = 'rdf4j'
    const checkRepo = this.createCheckRepositoryCustomResource(repositoryName)

    try {
      checkRepo.getResponseField('repositories')

      return ecr.Repository.fromRepositoryName(this, 'Existingrdf4jRepository', repositoryName)
    } catch {
      return new ecr.Repository(this, 'rdf4jRepository', {
        repositoryName,
        removalPolicy: RemovalPolicy.RETAIN
      })
    }
  }

  private createCheckRepositoryCustomResource(repositoryName: string): custom.AwsCustomResource {
    return new custom.AwsCustomResource(this, 'CheckRepository', {
      onUpdate: {
        service: 'ECR',
        action: 'describeRepositories',
        parameters: { repositoryNames: [repositoryName] },
        physicalResourceId: custom.PhysicalResourceId.of(Date.now().toString())
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom.AwsCustomResourcePolicy.ANY_RESOURCE
      }),
      installLatestAwsSdk: false
    })
  }

  private createLogGroup(): logs.LogGroup {
    return new logs.LogGroup(this, 'rdf4jContainerLogs', {
      logGroupName: '/ecs/rdf4j',
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY
    })
  }

  private createEcsService(): void {
    this.ecsService = new ecs.Ec2Service(this, 'rdf4jService', {
      cluster: this.cluster,
      taskDefinition: this.taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      enableExecuteCommand: true,
      securityGroups: [this.ecsTasksSecurityGroup],
      assignPublicIp: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: [this.getEbsVolumeAz()]
      },
      capacityProviderStrategies: [
        {
          capacityProvider: this.capacityProvider.capacityProviderName,
          weight: 1
        }
      ]
    })

    // Attach ECS service to the imported target group
    this.ecsService.attachToApplicationTargetGroup(this.targetGroup)
  }

  private getContainerMemoryLimit(): number {
    // Default to 14336 (14 GiB) if not specified
    return parseInt(process.env.RDF4J_CONTAINER_MEMORY_LIMIT || '14336', 10)
  }

  private createTaskDefinition(): ecs.Ec2TaskDefinition {
    return new ecs.Ec2TaskDefinition(this, 'rdf4jTaskDefinition', {
      taskRole: this.role,
      executionRole: this.role,
      networkMode: ecs.NetworkMode.AWS_VPC
    })
  }

  private addContainerToTaskDefinition(
    taskDefinition: ecs.Ec2TaskDefinition
  ): ecs.ContainerDefinition {
    const VERSION = process.env.VERSION || 'latest'

    const container = taskDefinition.addContainer('rdf4jContainer', {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, VERSION),
      user: 'root',
      memoryLimitMiB: this.getContainerMemoryLimit(),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'rdf4j',
        logGroup: this.logGroup
      }),
      environment: {
        ACCOUNT: process.env.CDK_DEFAULT_ACCOUNT || '',
        REGION: process.env.CDK_DEFAULT_REGION || '',
        RDF4J_DATA_DIR: '/rdf4j-data',
        RDF4J_USER_NAME: process.env.RDF4J_USER_NAME || '',
        RDF4J_PASSWORD: process.env.RDF4J_PASSWORD || '',
        RDF4J_CONTAINER_MEMORY_LIMIT: this.getContainerMemoryLimit().toString()
      }
    })

    container.addPortMappings({
      containerPort: 8080,
      hostPort: 8080,
      protocol: ecs.Protocol.TCP
    })

    return container
  }

  private addEbsVolumeToTaskDefinition(taskDefinition: ecs.Ec2TaskDefinition): void {
    taskDefinition.addVolume({
      name: 'rdf4j-data',
      host: {
        sourcePath: '/mnt/rdf4j-data'
      }
    })
  }

  private addMountPointToContainer(container: ecs.ContainerDefinition): void {
    container.addMountPoints({
      containerPath: '/rdf4j-data',
      sourceVolume: 'rdf4j-data',
      readOnly: false
    })
  }

  private addOutputs(): void {
    // eslint-disable-next-line no-new
    new CfnOutput(this, 'rdf4jCluster', {
      value: this.cluster.clusterName,
      description: 'The rdf4j cluster',
      exportName: 'rdf4jCluster'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'rdf4jServiceName', {
      value: this.ecsService.serviceName,
      description: 'The rdf4j service name',
      exportName: 'rdf4jServiceName'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'EcsTasksSecurityGroupId', {
      value: this.ecsTasksSecurityGroup.securityGroupId,
      description: 'The ECS Tasks Security Group ID',
      exportName: 'rdf4jEcsTasksSecurityGroupId'
    })
  }
}
