/* eslint-disable no-new */
const {
  Stack, RemovalPolicy, CfnOutput, Size
} = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')

class EbsStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.volume = this.createEbsVolume()

    this.createOutputs()
  }

  getVpc(vpcId) {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  createEbsVolume() {
    return new ec2.Volume(this, 'rdf4jVolume', {
      availabilityZone: this.vpc.availabilityZones[0],
      size: Size.gibibytes(100), // Use Size.gibibytes() to specify the size
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      encrypted: true,
      removalPolicy: RemovalPolicy.RETAIN
    })
  }

  createOutputs() {
    new CfnOutput(this, 'VolumeId', {
      value: this.volume.volumeId,
      exportName: 'rdf4jVolumeId'
    })

    new CfnOutput(this, 'AvailabilityZone', {
      value: this.volume.availabilityZone,
      exportName: 'rdf4jVolumeAz'
    })
  }
}

module.exports = { EbsStack }
