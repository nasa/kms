/* eslint-disable no-new */
const {
  Stack, RemovalPolicy, CfnOutput, Size
} = require('aws-cdk-lib')
const ec2 = require('aws-cdk-lib/aws-ec2')

/**
 * Stack for creating an Elastic Block Store (EBS) volume for RDF4J.
 *
 * This stack is responsible for provisioning an EBS volume that will be used
 * to store data for an RDF4J database. It creates a GP3 volume with specified
 * size, IOPS, and throughput settings.
 *
 * @class
 * @extends Stack
 *
 * @property {ec2.Vpc} vpc - The VPC in which the EBS volume will be created.
 * @property {ec2.Volume} volume - The EBS volume created by this stack.
 *
 * @param {Construct} scope - The scope in which to define this construct.
 * @param {string} id - The scoped construct ID.
 * @param {object} props - Initialization properties.
 * @param {string} props.vpcId - The ID of the VPC in which to create the EBS volume.
 *
 * @example
 * const app = new cdk.App();
 * new EbsStack(app, 'EbsStack', {
 *   vpcId: 'vpc-1234567890abcdef0',
 *   env: { account: '123456789012', region: 'us-east-1' }
 * });
 */
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
      availabilityZone: 'us-east-1a',
      size: Size.gibibytes(parseInt(process.env.EBS_VOLUME_SIZE || '32', 10)),
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      iops: 3000,
      throughput: 125,
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
