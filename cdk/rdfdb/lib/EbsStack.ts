import {
  CfnOutput,
  RemovalPolicy,
  Size,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as custom from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'

interface EbsStackProps extends StackProps {
  vpcId: string;
}

/**
 * Stack for creating an Elastic Block Store (EBS) volume for RDF4J.
 *
 * This stack is responsible for provisioning an EBS volume that will be used
 * to store data for an RDF4J database. It creates a GP3 volume with specified
 * size, IOPS, and throughput settings.
 *
 * @property {ec2.IVpc} vpc - The VPC in which the EBS volume will be created.
 * @property {ec2.Volume} volume - The EBS volume created by this stack.
 *
 * @example
 * const app = new cdk.App();
 * new EbsStack(app, 'EbsStack', {
 *   vpcId: 'vpc-1234567890abcdef0',
 *   env: { account: '123456789012', region: 'us-east-1' }
 * });
 */

export interface IEbsStack {
  readonly vpc: ec2.IVpc;
  readonly volume: ec2.IVolume;
}

export class EbsStack extends Stack implements IEbsStack {
  public readonly vpc: ec2.IVpc

  public readonly volume: ec2.IVolume

  private readonly existingVolumeId?: string

  constructor(scope: Construct, id: string, props: EbsStackProps) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.existingVolumeId = this.getExistingVolumeId()
    this.volume = this.createEbsVolume()

    this.createOutputs()
  }

  private getVpc(vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  // Return the restored EBS volume ID when we want CDK to attach an already-restored volume.
  private getExistingVolumeId(): string | undefined {
    return process.env.EBS_VOLUME_ID?.trim() || undefined
  }

  // Use the first VPC availability zone for the RDF4J EBS volume.
  private getAvailabilityZone(): string {
    const [defaultAvailabilityZone] = this.vpc.availabilityZones

    if (!defaultAvailabilityZone) {
      throw new Error('Could not determine an availability zone for the RDF4J EBS volume')
    }

    return defaultAvailabilityZone
  }

  // Preserve the current 32 GiB default when CDK needs to create a new blank volume.
  private getVolumeSize(): Size {
    return Size.gibibytes(32)
  }

  // Read the availability zone of an existing restored volume so ECS can launch in the same AZ.
  private getExistingVolumeAvailabilityZone(volumeId: string): string {
    const describeVolume = new custom.AwsCustomResource(this, 'DescribeExistingRdf4jVolume', {
      onUpdate: {
        service: 'EC2',
        action: 'describeVolumes',
        parameters: {
          VolumeIds: [volumeId]
        },
        physicalResourceId: custom.PhysicalResourceId.of(volumeId)
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom.AwsCustomResourcePolicy.ANY_RESOURCE
      }),
      installLatestAwsSdk: false
    })

    return describeVolume.getResponseField('Volumes.0.AvailabilityZone')
  }

  // Either import a pre-restored EBS volume or create a new blank one.
  private createEbsVolume(): ec2.IVolume {
    if (this.existingVolumeId) {
      return ec2.Volume.fromVolumeAttributes(this, 'ImportedRdf4jVolume', {
        volumeId: this.existingVolumeId,
        availabilityZone: this.getExistingVolumeAvailabilityZone(this.existingVolumeId)
      })
    }

    return new ec2.Volume(this, 'rdf4jVolume', {
      availabilityZone: this.getAvailabilityZone(),
      size: this.getVolumeSize(),
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      iops: 3000,
      throughput: 125,
      encrypted: true,
      removalPolicy: RemovalPolicy.RETAIN
    })
  }

  private createOutputs(): void {
    // eslint-disable-next-line no-new
    new CfnOutput(this, 'VolumeId', {
      value: this.volume.volumeId,
      exportName: 'rdf4jVolumeId'
    })

    // eslint-disable-next-line no-new
    new CfnOutput(this, 'AvailabilityZone', {
      value: this.volume.availabilityZone,
      exportName: 'rdf4jVolumeAz'
    })

    if (this.existingVolumeId) {
      // eslint-disable-next-line no-new
      new CfnOutput(this, 'ExistingVolumeId', {
        value: this.existingVolumeId,
        description: 'Existing restored RDF4J EBS volume imported into the stack'
      })
    }
  }
}
