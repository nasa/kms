// Snapshot-stack.js

const { Stack, Duration } = require('aws-cdk-lib')
const backup = require('aws-cdk-lib/aws-backup')
const events = require('aws-cdk-lib/aws-events')

class SnapshotStack extends Stack {
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
    // Select the resources to backup
    const backupSelection = new backup.BackupSelection(this, 'RDF4JVolumeSelection', {
      backupPlan: plan,
      resources: [
        backup.BackupResource.fromArn(`arn:aws:ec2:${this.region}:${this.account}:volume/${ebsVolumeId}`)
      ]
    })

    console.log('Backup Configuration Created:')
    console.log(`  Backup Selection Logical ID: ${backupSelection.node.id}`)
    console.log(`  Resource Count: ${backupSelection.resources.length}`)
    console.log(`  First Resource ARN: ${backupSelection.resources[0].toString()}`)
    console.log(`  Backup Plan Name: ${plan.backupPlanName}`)
    console.log(`  Backup Vault Name: ${backupVault.backupVaultName}`)
    console.log(`  Backup Schedule: ${cronExpression}`)
  }
}

module.exports = { SnapshotStack }
