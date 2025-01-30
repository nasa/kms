const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib')
const efs = require('aws-cdk-lib/aws-efs')
const ec2 = require('aws-cdk-lib/aws-ec2')

class EfsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.ecsTasksSecurityGroup = this.createEcsTasksSecurityGroup()
    this.fileSystem = this.createFileSystem()
    this.accessPoint = this.createAccessPoint()

    this.configureEFSSecurityGroups()
    this.createOutputs()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  createEcsTasksSecurityGroup() {
    return new ec2.SecurityGroup(this, 'EcsTasksSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true
    })
  }

  createFileSystem() {
    return new efs.FileSystem(this, 'rdf4jFileSystem', {
      vpc: this.vpc,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      encrypted: true,
      removalPolicy: RemovalPolicy.RETAIN
    })
  }

  createAccessPoint() {
    return this.fileSystem.addAccessPoint('AccessPoint', {
      path: '/rdf4j-data',
      createAcl: {
        ownerUid: '101',
        ownerGid: '65534',
        permissions: '755'
      },
      posixUser: {
        uid: '101',
        gid: '65534'
      }
    })
  }

  configureEFSSecurityGroups() {
    this.fileSystem.connections.allowDefaultPortFrom(this.ecsTasksSecurityGroup)

    this.ecsTasksSecurityGroup.addIngressRule(
      this.fileSystem.connections.securityGroups[0],
      ec2.Port.tcp(2049),
      'Allow ECS tasks to access EFS'
    )

    this.fileSystem.connections.securityGroups[0].addIngressRule(
      this.ecsTasksSecurityGroup,
      ec2.Port.tcp(2049),
      'Allow EFS to accept connections from ECS tasks'
    )
  }

  createOutputs() {
    new CfnOutput(this, 'FileSystemId', {
      value: this.fileSystem.fileSystemId,
      exportName: 'rdf4jFileSystemId'
    })

    new CfnOutput(this, 'AccessPointId', {
      value: this.accessPoint.accessPointId,
      exportName: 'rdf4jAccessPointId'
    })
  }
}

module.exports = { EfsStack }
