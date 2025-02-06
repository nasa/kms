/* eslint-disable no-new */
const {
  Stack,
  RemovalPolicy,
  Duration,
  CfnOutput,
  Fn
} = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')
const iam = require('aws-cdk-lib/aws-iam')
const ecr = require('aws-cdk-lib/aws-ecr')
const ecs = require('aws-cdk-lib/aws-ecs')
const logs = require('aws-cdk-lib/aws-logs')
const elbv2 = require('aws-cdk-lib/aws-elasticloadbalancingv2')
const custom = require('aws-cdk-lib/custom-resources')
const servicediscovery = require('aws-cdk-lib/aws-servicediscovery')
const cloudwatch = require('aws-cdk-lib/aws-cloudwatch')
const lambda = require('aws-cdk-lib/aws-lambda')
const lambdaNodejs = require('aws-cdk-lib/aws-lambda-nodejs')
const path = require('path')
const targets = require('aws-cdk-lib/aws-elasticloadbalancingv2-targets')
const dynamodb = require('aws-cdk-lib/aws-dynamodb')

/**
 * This stack creates a fully-functional, scalable RDF4J cluster with a master-slave
 * architecture, using ECS for container orchestration, EFS for shared storage, and a
 * Lambda function for intelligent request routing. It includes configurations for
 * networking, security, auto-scaling, and monitoring in order to deploy and
 * manage a distributed RDF4J service on AWS.
 */
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
    this.lambdaSecurityGroup = this.createLambdaSecurityGroup()
    this.cluster = this.createEcsCluster()
    this.repository = this.createOrGetEcrRepository()
    this.logGroup = this.createLogGroup()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  createRole() {
    return iam.Role.fromRoleArn(this, 'ImportedRole', Fn.importValue('rdf4jRoleArn'))
  }

  getEcsTasksSecurityGroup(ecsTasksSecurityGroup) {
    return ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedEcsTasksSecurityGroup',
      ecsTasksSecurityGroup.securityGroupId
    )
  }

  createLambdaSecurityGroup() {
    return new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group for Lambda function'
    })
  }

  createEcsCluster() {
    return new ecs.Cluster(this, 'rdf4jEcsCluster', {
      vpc: this.vpc,
      clusterName: 'rdf4jEcs',
      defaultCloudMapNamespace: {
        name: 'rdf4j.local'
      }
    })
  }

  createOrGetEcrRepository() {
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

      return ecr.Repository.fromRepositoryName(this, 'ExistingrRDF4JRepository', repositoryName)
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
    const masterTaskDefinition = this.createTaskDefinition('master')
    const slaveTaskDefinition = this.createTaskDefinition('slave')

    const masterContainer = this.addContainerToTaskDefinition(masterTaskDefinition, 'master')
    const slaveContainer = this.addContainerToTaskDefinition(slaveTaskDefinition, 'slave')

    const mountConfig = {
      master: {
        sourcePath: 'rdf4j-data',
        containerPath: '/rdf4j-data',
        readOnly: false
      },
      slave: {
        sourcePath: 'shared-data',
        containerPath: '/shared-data',
        readOnly: true
      }
    }

    this.addMountPointToContainer(masterContainer, 'master', mountConfig)
    this.addMountPointToContainer(slaveContainer, 'slave', mountConfig)

    this.masterService = this.createMasterFargateService(masterTaskDefinition)
    this.slaveService = this.createSlaveFargateService(slaveTaskDefinition)

    this.nodesCacheTable = new dynamodb.Table(this, 'NodesCacheTable', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    this.verifiedNodesTable = new dynamodb.Table(this, 'VerifiedNodesTable', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    })

    this.proxyLambda = this.createLambdaFunction()

    this.configureLoadBalancer()
    this.configureAutoScaling(this.slaveService)
    this.createMetricFilters()
    this.grantLambdaPermissions()
  }

  grantLambdaPermissions() {
    const lambdaRole = this.proxyLambda.role

    // Grant DynamoDB permissions
    this.nodesCacheTable.grantReadWriteData(lambdaRole)
    this.verifiedNodesTable.grantReadWriteData(lambdaRole)

    // Allow Lambda to resolve Service Discovery DNS names
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'servicediscovery:ListNamespaces',
        'servicediscovery:ListServices',
        'servicediscovery:DiscoverInstances'
      ],
      resources: ['*']
    }))

    // Allow inbound traffic from Lambda to ECS tasks
    new ec2.CfnSecurityGroupIngress(this, 'AllowLambdaToEcsTasks', {
      groupId: this.ecsTasksSecurityGroup.securityGroupId,
      sourceSecurityGroupId: this.lambdaSecurityGroup.securityGroupId,
      fromPort: 8080,
      toPort: 8080,
      ipProtocol: 'tcp',
      description: 'Allow Lambda to access ECS tasks'
    })

    // Grant permissions to describe and list ECS services and tasks
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:ListServices', // Added this line
        'ecs:DescribeServices',
        'ecs:DescribeTasks',
        'ecs:ListTasks'
      ],
      resources: ['*']
    }))

    // Grant permissions to invoke the ECS tasks
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:RunTask'
      ],
      resources: [
        this.masterService.taskDefinition.taskDefinitionArn,
        this.slaveService.taskDefinition.taskDefinitionArn
      ]
    }))

    // Grant permission to update ECS services
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecs:UpdateService'],
      resources: ['*']
    }))
  }

  createTaskDefinition(role) {
    const taskDefinition = new ecs.FargateTaskDefinition(this, `rdf4jTaskDef${role}`, {
      memoryLimitMiB: 3072,
      cpu: 1024,
      executionRole: this.role,
      taskRole: this.role,
      networkMode: ecs.NetworkMode.AWS_VPC
    })

    taskDefinition.addVolume(this.createEfsVolume('rdf4j-data'))
    taskDefinition.addVolume(this.createEfsVolume('shared-data'))

    return taskDefinition
  }

  createEfsVolume(name) {
    return {
      name,
      efsVolumeConfiguration: {
        fileSystemId: this.fileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: this.accessPoint.accessPointId,
          iam: 'ENABLED'
        }
      }
    }
  }

  addContainerToTaskDefinition(taskDefinition, role) {
    const VERSION = process.env.VERSION || 'latest'

    const environmentVariables = {
      REGION: this.region,
      ACCOUNT: this.account,
      RDF4J_USER_NAME: process.env.RDF4J_USER_NAME,
      RDF4J_PASSWORD: process.env.RDF4J_PASSWORD,
      RDF4J_ROLE: role,
      MASTER_SERVICE_NAME: 'master.rdf4j.local'
    }

    if (role === 'master') {
      environmentVariables.RDF4J_DATA_DIR = '/rdf4j-data'
    }

    return taskDefinition.addContainer('rdf4j-container', {
      image: ecs.ContainerImage.fromEcrRepository(this.repository, VERSION),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'rdf4j-ecs',
        logGroup: this.logGroup
      }),
      environment: environmentVariables,
      portMappings: [{ containerPort: 8080 }],
      essential: true,
      memoryReservationMiB: 512,
      healthCheck: {
        command: [
          'CMD-SHELL',
          'curl -f http://localhost:8080/rdf4j-server/protocol || exit 1'
        ],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(60)
      }
    })
  }

  addMountPointToContainer(container, role, mountConfig) {
    const { sourcePath, containerPath, readOnly } = mountConfig[role]

    container.addMountPoints({
      sourceVolume: sourcePath,
      containerPath,
      readOnly
    })
  }

  createMasterFargateService(taskDefinition) {
    return new ecs.FargateService(this, 'rdf4jMasterService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.ecsTasksSecurityGroup],
      cloudMapOptions: {
        name: 'master',
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.seconds(60),
        failureThreshold: 1
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS
      },
      circuitBreaker: { rollback: true }
    })
  }

  createSlaveFargateService(taskDefinition) {
    return new ecs.FargateService(this, 'rdf4jSlaveService', {
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 2,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.ecsTasksSecurityGroup],
      cloudMapOptions: {
        name: 'slave',
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: Duration.seconds(60),
        failureThreshold: 1
      },
      healthCheck: {
        command: [
          'CMD-SHELL',
          'curl -f http://localhost:8080/rdf4j-server/protocol && '
      + 'curl -f http://master.rdf4j.local:8080/rdf4j-server/protocol || exit 1'
        ],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(10),
        retries: 3,
        startPeriod: Duration.seconds(60)
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS
      },
      circuitBreaker: { rollback: true }
    })
  }

  configureLoadBalancer() {
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'rdf4jLoadBalancer', {
      vpc: this.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }
    })

    const listener = this.loadBalancer.addListener('Listener', {
      port: 80,
      open: true
    })

    const lambdaTarget = new targets.LambdaTarget(this.proxyLambda)

    listener.addTargets('LambdaProxyTarget', {
      targets: [lambdaTarget],
      healthCheck: {
        path: '/health',
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyHttpCodes: '200',
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2
      }
    })

    // Register the load balancer with Service Discovery
    new servicediscovery.Service(this, 'LoadBalancerDiscoveryService', {
      namespace: this.cluster.defaultCloudMapNamespace,
      name: 'loadbalancer',
      dnsRecordType: servicediscovery.DnsRecordType.A,
      customHealthCheck: { failureThreshold: 1 },
      loadBalancer: this.loadBalancer
    })
  }

  configureAutoScaling(service) {
    const scaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 5
    })

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)
    })

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)
    })
  }

  createLambdaFunction() {
    return new lambdaNodejs.NodejsFunction(this, 'rdf4jProxyLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/rdf4j-proxy/index.js'),
      forceDockerBundling: true,
      timeout: Duration.seconds(60),
      environment: {
        LOAD_BALANCER_NAME: 'loadbalancer.rdf4j.local',
        MASTER_SERVICE_NAME: this.masterService.cloudMapService.serviceName,
        SERVICE_DISCOVERY_NAMESPACE: this.cluster.defaultCloudMapNamespace.namespaceName,
        ECS_CLUSTER_NAME: this.cluster.clusterName,
        ECS_SERVICE_NAME_PREFIX: 'rdf4j',
        RDF4J_REPOSITORY_ID: 'kms',
        RDF4J_USER_NAME: process.env.RDF4J_USER_NAME,
        RDF4J_PASSWORD: process.env.RDF4J_PASSWORD,
        STACK_NAME: this.stackName,
        NODES_CACHE_TABLE: this.nodesCacheTable.tableName,
        VERIFIED_NODES_TABLE: this.verifiedNodesTable.tableName
      },
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.ecsTasksSecurityGroup, this.lambdaSecurityGroup]
    })
  }

  createMetricFilters() {
    const albLogGroupName = `/aws/applicationelbalancer/${this.loadBalancer.loadBalancerName}`

    const albLogGroup = new logs.LogGroup(this, 'ALBLogGroup', {
      logGroupName: albLogGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'].forEach((method) => {
      new logs.MetricFilter(this, `${method}RequestFilter`, {
        logGroup: albLogGroup,
        filterPattern: logs.FilterPattern.literal(`[..., method="${method}", status_code, size]`),
        metricNamespace: 'rdf4jApplicationLB',
        metricName: `${method}Requests`,
        defaultValue: 0,
        unit: cloudwatch.Unit.COUNT,
        metricValue: '1'
      })
    })
  }

  configureSecurity() {
    // Allow ECS tasks to access the EFS file system
    this.fileSystem.connections.allowDefaultPortFrom(this.ecsTasksSecurityGroup)

    // Allow inbound traffic to the load balancer
    this.loadBalancer.connections.allowFrom(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow inbound HTTP traffic'
    )

    // Allow traffic from the load balancer to the ECS tasks
    this.ecsTasksSecurityGroup.connections.allowFrom(
      this.loadBalancer,
      ec2.Port.tcp(8080),
      'Allow traffic from ALB to ECS tasks'
    )
  }

  addOutputs() {
    new CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'DNS name of the load balancer'
    })

    new CfnOutput(this, 'rdf4jServiceUrl', {
      value: `http://${this.loadBalancer.loadBalancerDnsName}`,
      description: 'URL of the RDF4J service'
    })

    new CfnOutput(this, 'EcsClusterName', {
      value: this.cluster.clusterName,
      description: 'Name of the ECS cluster'
    })

    new CfnOutput(this, 'MasterServiceName', {
      value: this.masterService.serviceName,
      description: 'Name of the master ECS service'
    })

    new CfnOutput(this, 'SlaveServiceName', {
      value: this.slaveService.serviceName,
      description: 'Name of the slave ECS service'
    })

    new CfnOutput(this, 'ServiceDiscoveryNamespace', {
      value: this.cluster.defaultCloudMapNamespace.namespaceName,
      description: 'Service Discovery Namespace for RDF4J services'
    })

    // Add HTTP method metrics
    this.addHttpMethodMetricOutputs()
  }

  addHttpMethodMetricOutputs() {
    ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'].forEach((method) => {
      new CfnOutput(this, `${method}RequestMetric`, {
        value: `rdf4jApplicationLB/${method}Requests`,
        description: `CloudWatch metric for ${method} requests`
      })
    })
  }
}
module.exports = { EcsStack }
