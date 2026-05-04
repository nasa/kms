import {
  CfnOutput,
  RemovalPolicy,
  Size,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
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
  readonly volume: ec2.Volume;
}

export class EbsStack extends Stack implements IEbsStack {
  public readonly vpc: ec2.IVpc

  public readonly volume: ec2.Volume

  private readonly snapshotId?: string

  constructor(scope: Construct, id: string, props: EbsStackProps) {
    super(scope, id, props)
    const { vpcId } = props

    this.vpc = this.getVpc(vpcId)
    this.snapshotId = this.getSnapshotId()
    this.volume = this.createEbsVolume()

    this.createOutputs()
  }

  private getVpc(vpcId: string): ec2.IVpc {
    return ec2.Vpc.fromLookup(this, 'VPC', { vpcId })
  }

  // Use the first VPC availability zone for the RDF4J EBS volume.
  private getAvailabilityZone(): string {
    const [defaultAvailabilityZone] = this.vpc.availabilityZones

    if (!defaultAvailabilityZone) {
      throw new Error('Could not determine an availability zone for the RDF4J EBS volume')
    }

    return defaultAvailabilityZone
  }

  // Return the restored EBS snapshot ID when we are rebuilding the volume from backup.
  private getSnapshotId(): string | undefined {
    return process.env.EBS_SNAPSHOT_ID?.trim() || undefined
  }

  // Parse the configured EBS volume size and preserve the current 32 GiB default for blank volumes.
  private getVolumeSize(snapshotId?: string): Size | undefined {
    const configuredVolumeSize = process.env.EBS_VOLUME_SIZE?.trim()

    if (configuredVolumeSize) {
      return Size.gibibytes(parseInt(configuredVolumeSize, 10))
    }

    if (snapshotId) {
      return undefined
    }

    return Size.gibibytes(32)
  }

  private createEbsVolume(): ec2.Volume {
    return new ec2.Volume(this, 'rdf4jVolume', {
      availabilityZone: this.getAvailabilityZone(),
      size: this.getVolumeSize(this.snapshotId),
      snapshotId: this.snapshotId,
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

    if (this.snapshotId) {
      // eslint-disable-next-line no-new
      new CfnOutput(this, 'SourceSnapshotId', {
        value: this.snapshotId,
        description: 'Snapshot used to restore the RDF4J EBS volume'
      })
    }
  }
}
