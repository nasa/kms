/* eslint-disable no-new */
const fs = require('fs')
const path = require('path')

const {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack
} = require('aws-cdk-lib')
const autoscaling = require('aws-cdk-lib/aws-autoscaling')
const ec2 = require('aws-cdk-lib/aws-ec2')
const ecr = require('aws-cdk-lib/aws-ecr')
const ecs = require('aws-cdk-lib/aws-ecs')
const elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2')
const iam = require('aws-cdk-lib/aws-iam')
const logs = require('aws-cdk-lib/aws-logs')
const custom = require('aws-cdk-lib/custom-resources')

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
 *
 * @extends Stack
 */class EcsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId, roleArn, ebsStack } = props

    this.ebsStack = ebsStack
    this.initializeBaseResources(vpcId, roleArn)
    this.addSecurityGroupRules()
    this.addOutputs()
  }

  initializeBaseResources(vpcId, roleArn) {
    this.vpc = this.getVpc(vpcId)
    this.role = this.getRole(roleArn)
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

  createSecurityGroups() {
    this.ecsTasksSecurityGroup = new ec2.SecurityGroup(this, 'EcsTasksSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true
    })
  }

  addSecurityGroupRules() {
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

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  getEbsVolumeId() {
    return this.ebsStack.volume.volumeId
  }

  getEbsVolumeAz() {
    return this.ebsStack.volume.availabilityZone
  }

  getRole() {
    return iam.Role.fromRoleArn(this, 'ImportedRole', Fn.importValue('rdf4jRoleArn'))
  }

  getInstanceType() {
    const instanceType = process.env.RDF4J_INSTANCE_TYPE || 'R5.LARGE'
    const [instanceClass, instanceSize] = instanceType.split('.')

    return ec2.InstanceType.of(ec2.InstanceClass[instanceClass], ec2.InstanceSize[instanceSize])
  }

  createEcsCluster() {
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
      clusterName: 'rdf4jEcs',
      securityGroups: [this.ecsTasksSecurityGroup]
    })

    this.capacityProvider = new ecs.AsgCapacityProvider(this, 'rdf4jAsgCapacityProvider', {
      autoScalingGroup,
      enableManagedTerminationProtection: false // Maybe remove.
    })

    cluster.addAsgCapacityProvider(this.capacityProvider)

    return cluster
  }

  createOrGetECRRepository() {
    const repositoryName = 'rdf4j'
    const checkRepo = this.createCheckRepositoryCustomResource(repositoryName)

    try {
      checkRepo.getResponseField('repositories')

      return ecr.Repository.fromRepositoryName(this, 'Existingrdf4jRepository', repositoryName)
    } catch (e) {
      return new ecr.Repository(this, 'rdf4jRepository', {
        repositoryName,
        removalPolicy: RemovalPolicy.RETAIN
      })
    }
  }

  createCheckRepositoryCustomResource(repositoryName) {
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

  createLogGroup() {
    return new logs.LogGroup(this, 'rdf4jContainerLogs', {
      logGroupName: '/ecs/rdf4j',
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY
    })
  }

  createEcsService() {
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

  getContainerMemoryLimit() {
  // Default to 14336 (14 GiB) if not specified
    return parseInt(process.env.RDF4J_CONTAINER_MEMORY_LIMIT || '14336', 10)
  }

  createTaskDefinition() {
    const taskDef = new ecs.Ec2TaskDefinition(this, 'rdf4jTaskDefinition', {
      taskRole: this.role,
      executionRole: this.role,
      networkMode: ecs.NetworkMode.AWS_VPC,
      memory: this.getContainerMemoryLimit()
    })

    return taskDef
  }

  addContainerToTaskDefinition(taskDefinition) {
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
        ACCOUNT: process.env.CDK_DEFAULT_ACCOUNT,
        REGION: process.env.CDK_DEFAULT_REGION,
        RDF4J_DATA_DIR: '/rdf4j-data',
        RDF4J_USER_NAME: process.env.RDF4J_USER_NAME,
        RDF4J_PASSWORD: process.env.RDF4J_PASSWORD,
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

  addEbsVolumeToTaskDefinition(taskDefinition) {
    taskDefinition.addVolume({
      name: 'rdf4j-data',
      host: {
        sourcePath: '/mnt/rdf4j-data'
      }
    })
  }

  addMountPointToContainer(container) {
    container.addMountPoints({
      containerPath: '/rdf4j-data',
      sourceVolume: 'rdf4j-data',
      readOnly: false
    })
  }

  addOutputs() {
    new CfnOutput(this, 'rdf4jCluster', {
      value: this.cluster.clusterName,
      description: 'The rdf4j cluster',
      exportName: 'rdf4jCluster'
    })

    new CfnOutput(this, 'rdf4jServiceName', {
      value: this.ecsService.serviceName,
      description: 'The rdf4j service name',
      exportName: 'rdf4jServiceName'
    })

    new CfnOutput(this, 'EcsTasksSecurityGroupId', {
      value: this.ecsTasksSecurityGroup.securityGroupId,
      description: 'The ECS Tasks Security Group ID',
      exportName: 'rdf4jEcsTasksSecurityGroupId'
    })
  }
}

module.exports = { EcsStack }
