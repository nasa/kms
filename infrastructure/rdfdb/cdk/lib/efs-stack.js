/* eslint-disable no-new */
const { Stack, RemovalPolicy, CfnOutput } = require('aws-cdk-lib')
const efs = require('aws-cdk-lib/aws-efs')
const ec2 = require('aws-cdk-lib/aws-ec2')

class EfsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.fileSystem = this.createFileSystem()
    this.accessPoint = this.createAccessPoint()

    this.createOutputs()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
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

  createOutputs() {
    new CfnOutput(this, 'FileSystemId', {
      value: this.fileSystem.fileSystemId,
      exportName: 'rdf4jFileSystemId'
    })

    new CfnOutput(this, 'AccessPointId', {
      value: this.accessPoint.accessPointId,
      exportName: 'rdf4jAccessPointId'
    })

    // Output the security group ID
    new CfnOutput(this, 'EfsSecurityGroupId', {
      value: this.fileSystem.connections.securityGroups[0].securityGroupId,
      description: 'The ID of the EFS Security Group',
      exportName: 'rdf4jEfsSecurityGroupId'
    })
  }
}

module.exports = { EfsStack }
