const { Stack, Duration } = require('aws-cdk-lib')
const backup = require('aws-cdk-lib/aws-backup')
const events = require('aws-cdk-lib/aws-events')

/**
 * SnapshotStack creates an AWS Backup configuration for an EBS volume using AWS CDK.
 *
 * This stack sets up an automated backup system for a specified EBS volume. It creates
 * a backup vault, defines a backup plan with a customizable schedule, and selects the
 * EBS volume as the resource to be backed up.
 *
 * @class
 * @extends {Stack}
 */
class SnapshotStack extends Stack {
  /**
   * Constructs a new instance of SnapshotStack.
   *
   * @param {Construct} scope - The scope in which to define this construct.
   * @param {string} id - The scoped construct ID.
   * @param {object} props - Initialization properties.
   * @param {string} props.ebsVolumeId - The ID of the EBS volume to be backed up.
   */
  constructor(scope, id, props) {
    super(scope, id, props)

    const { ebsVolumeId } = props

    // Get the cron expression from environment variable or use a default
    const cronExpression = process.env.SNAPSHOT_CRON_EXPRESSION_UTC || '0 5 * * ? *' // Midnight EST

    // Create a backup vault
    const backupVault = new backup.BackupVault(this, 'RDF4JBackupVault', {
      backupVaultName: 'rdf4j-backup-vault'
    })

    // Create a backup plan
    const plan = new backup.BackupPlan(this, 'RDF4JBackupPlan', {
      backupPlanName: 'rdf4j-backup-plan',
      backupVault
    })

    // Add a rule to the plan
    plan.addRule(new backup.BackupPlanRule({
      completionWindow: Duration.hours(2),
      startWindow: Duration.hours(1),
      scheduleExpression: events.Schedule.expression(`cron(${cronExpression})`),
      deleteAfter: Duration.days(14)
    }))

    // Select the resources to backup
    // eslint-disable-next-line no-new
    new backup.BackupSelection(this, 'RDF4JVolumeSelection', {
      backupPlan: plan,
      resources: [
        backup.BackupResource.fromArn(`arn:aws:ec2:${this.region}:${this.account}:volume/${ebsVolumeId}`)
      ]
    })
  }
}

module.exports = { SnapshotStack }
