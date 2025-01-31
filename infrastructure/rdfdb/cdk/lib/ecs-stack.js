/* eslint-disable no-new */
const {
  Stack, RemovalPolicy, Duration, CfnOutput,
  Fn
} = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const iam = require('aws-cdk-lib/aws-iam')
const ecr = require('aws-cdk-lib/aws-ecr')
const ecs = require('aws-cdk-lib/aws-ecs')
const logs = require('aws-cdk-lib/aws-logs')
const ecspatterns = require('aws-cdk-lib/aws-ecs-patterns')
const elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2')
const custom = require('aws-cdk-lib/custom-resources')

class EcsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const {
      vpcId, fileSystem, accessPoint, ecsTasksSecurityGroup
    } = props

    this.initializeResources(vpcId, fileSystem, accessPoint, ecsTasksSecurityGroup)
    this.createEcsResources()
    this.configureSecurity()
    this.addOutputs()
  }

  initializeResources(vpcId, fileSystem, accessPoint, ecsTasksSecurityGroup) {
    this.vpc = this.getVpc(vpcId)
    this.role = this.createRole()
    this.fileSystem = fileSystem
    this.accessPoint = accessPoint
    this.ecsTasksSecurityGroup = this.getEcsTasksSecurityGroup(ecsTasksSecurityGroup)
    this.cluster = this.createECSCluster()
    this.repository = this.createOrGetECRRepository()
    this.logGroup = this.createLogGroup()
  }

  createRole() {
    return iam.Role.fromRoleArn(this, 'ImportedRole', Fn.importValue('rdf4jRoleArn'))
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  getEcsTasksSecurityGroup(ecsTasksSecurityGroup) {
    return ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedEcsTasksSecurityGroup',
      ecsTasksSecurityGroup.securityGroupId
    )
  }

  createECSCluster() {
    return new ecs.Cluster(this, 'rdf4jEcsCluster', {
      vpc: this.vpc,
      clusterName: 'rdf4jEcs'
    })
  }

  createOrGetECRRepository() {
    const repositoryName = 'rdf4j'
    const checkRepo = this.createCheckRepositoryCustomResource(repositoryName)

    return this.getOrCreateRepository(repositoryName, checkRepo)
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

  getOrCreateRepository(repositoryName, checkRepo) {
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

  createLogGroup() {
    return new logs.LogGroup(this, 'rdf4jContainerLogs', {
      logGroupName: '/ecs/rdf4j',
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY
    })
  }

  createEcsResources() {
    const taskDefinition = this.createTaskDefinition()
    const container = this.addContainerToTaskDefinition(taskDefinition)
    this.addEFSVolumeToTaskDefinition(taskDefinition)
    this.addMountPointToContainer(container)
    this.fargateService = this.createFargateService(taskDefinition)
    this.configureAutoScaling(this.fargateService)
    this.configureHealthCheck(this.fargateService)
  }

  createTaskDefinition() {
    return new ecs.FargateTaskDefinition(this, 'rdf4jTaskDef', {
      memoryLimitMiB: 3072,
      cpu: 1024,
      executionRole: this.role,
      taskRole: this.role,
      networkMode: ecs.NetworkMode.AWS_VPC
    })
  }

  addContainerToTaskDefinition(taskDefinition) {
    const VERSION = process.env.VERSION || 'latest'

    return taskDefinition.addContainer('rdf4j-container', {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, VERSION),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'rdf4j-ecs',
        logGroup: this.logGroup
      }),
      environment: {
        REGION: this.region,
        ACCOUNT: this.account,
        rdf4j_DATA_DIR: '/rdf4j-data',
        RDF4J_USER_NAME: process.env.RDF4J_USER_NAME,
        RDF4J_PASSWORD: process.env.RDF4J_PASSWORD
      },
      portMappings: [{ containerPort: 8080 }],
      essential: true,
      memoryReservationMiB: 512
    })
  }

  addEFSVolumeToTaskDefinition(taskDefinition) {
    taskDefinition.addVolume({
      name: 'rdf4j-data',
      efsVolumeConfiguration: {
        fileSystemId: this.fileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: this.accessPoint.accessPointId,
          iam: 'ENABLED'
        }
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

  // Multiple processes can read from the RDF db, but only 1 can write.   A future ticket
  // will setup a lock manager so we can scale, but for now, we will prevent any scaling.
  // To prevent any scaling, we are setting the minHealthyPercent and maxHealthPercent.  This
  // ensures that during deployments, ECS will first stop the old task before starting a new one,
  // preventing any period where two tasks might be running simultaneously.
  createFargateService(taskDefinition) {
    return new ecspatterns.ApplicationLoadBalancedFargateService(this, 'rdf4jService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: false,
      listenerPort: 8080,
      targetProtocol: elbv2.ApplicationProtocol.HTTP,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      enableExecuteCommand: true,
      securityGroups: [this.ecsTasksSecurityGroup],
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT }
    })
  }

  // To further prevent any accidental scaling, we add a scaling lock.  This explicitly sets both the
  // minimum and maximum number of tasks to 1, preventing any scaling operations.
  configureAutoScaling(fargateService) {
    fargateService.service.autoScaleTaskCount({
      maxCapacity: 1,
      minCapacity: 1
    })
  }

  configureHealthCheck(fargateService) {
    fargateService.targetGroup.configureHealthCheck({
      path: '/rdf4j-server/protocol',
      port: '8080',
      healthyHttpCodes: '200,301,302',
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: Duration.seconds(10),
      interval: Duration.seconds(30),
      matcher: {
        httpCode: '200-399'
      }
    })
  }

  configureSecurity() {
    this.fileSystem.connections.allowDefaultPortFrom(this.ecsTasksSecurityGroup)
  }

  addOutputs() {
    new CfnOutput(this, 'LoadBalancerDNS', {
      value: this.fargateService.loadBalancer.loadBalancerDnsName,
      description: 'DNS name of the load balancer'
    })

    new CfnOutput(this, 'rdf4jServiceUrl', {
      value: `http://${this.fargateService.loadBalancer.loadBalancerDnsName}:8080`,
      description: 'URL of the RDF4J service'
    })
  }
}

module.exports = { EcsStack }
