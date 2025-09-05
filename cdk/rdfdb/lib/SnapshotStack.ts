import {
  Duration,
  Stack,
  StackProps
} from 'aws-cdk-lib'
import * as backup from 'aws-cdk-lib/aws-backup'
import * as events from 'aws-cdk-lib/aws-events'
import { Construct } from 'constructs'

export interface ISnapshotStack {
  readonly backupVault: backup.BackupVault;
  readonly backupPlan: backup.BackupPlan;
}

interface SnapshotStackProps extends StackProps {
  ebsVolumeId: string;
}

/**
 * SnapshotStack creates an AWS Backup configuration for an EBS volume using AWS CDK.
 *
 * This stack sets up an automated backup system for a specified EBS volume. It creates
 * a backup vault, defines a backup plan with a customizable schedule, and selects the
 * EBS volume as the resource to be backed up.
 */
export class SnapshotStack extends Stack implements ISnapshotStack {
  public readonly backupVault: backup.BackupVault

  public readonly backupPlan: backup.BackupPlan

  /**
   * Constructs a new instance of SnapshotStack.
   *
   * @param {Construct} scope - The scope in which to define this construct.
   * @param {string} id - The scoped construct ID.
   * @param {SnapshotStackProps} props - Initialization properties.
   */
  constructor(scope: Construct, id: string, props: SnapshotStackProps) {
    super(scope, id, props)

    const { ebsVolumeId } = props

    // Get the cron expression from environment variable or use a default
    const cronExpression = process.env.SNAPSHOT_CRON_EXPRESSION_UTC || '0 5 * * ? *' // Midnight EST

    // Create a backup vault
    this.backupVault = new backup.BackupVault(this, 'RDF4JBackupVault', {
      backupVaultName: 'rdf4j-backup-vault'
    })

    // Create a backup plan
    this.backupPlan = new backup.BackupPlan(this, 'RDF4JBackupPlan', {
      backupPlanName: 'rdf4j-backup-plan',
      backupVault: this.backupVault
    })

    // Add a rule to the plan
    this.backupPlan.addRule(new backup.BackupPlanRule({
      completionWindow: Duration.hours(2),
      startWindow: Duration.hours(1),
      scheduleExpression: events.Schedule.expression(`cron(${cronExpression})`),
      deleteAfter: Duration.days(14)
    }))

    // Select the resources to backup
    // eslint-disable-next-line no-new
    new backup.BackupSelection(this, 'RDF4JVolumeSelection', {
      backupPlan: this.backupPlan,
      resources: [
        backup.BackupResource.fromArn(`arn:aws:ec2:${this.region}:${this.account}:volume/${ebsVolumeId}`)
      ]
    })
  }
}
