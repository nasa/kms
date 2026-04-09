import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

/**
 * Interface for LogForwardingSetup properties
 */
interface LogForwardingSetupProps {
  /** Prefix for naming resources */
  prefix: string
  /** Deployment stage (sit, uat, prod) */
  stage: string
  /** AWS Account ID */
  account: string
  /** AWS Region */
  region: string
  /** Map of Lambda functions to configure log forwarding for */
  lambdas: { [key: string]: lambda.Function }
  /** Log retention period in days */
  logRetentionDays?: logs.RetentionDays
}

/**
 * Sets up CloudWatch Log Groups and Subscription Filters to forward logs to NGAP SecLog account.
 *
 * This class configures log forwarding to Splunk via NGAP's centralized logging infrastructure.
 * Logs are forwarded to a Kinesis stream in the SecLog account (353585529927) which then
 * forwards them to Splunk.
 *
 * @see https://wiki.earthdata.nasa.gov/pages/viewpage.action?pageId=147423378
 */
export class LogForwardingSetup {
  /** The AWS account-specific destination name for log forwarding */
  private readonly destinationName: string

  /** The Kinesis stream ARN in the SecLog account */
  private readonly targetArn: string = 'arn:aws:kinesis:us-east-1:353585529927:stream/application_logs'

  /** Log retention period */
  private readonly logRetentionDays: logs.RetentionDays

  /**
   * Constructs a new LogForwardingSetup instance
   * @param {Construct} scope - The scope in which to define this construct
   * @param {string} id - The construct ID
   * @param {LogForwardingSetupProps} props - Configuration properties
   */
  constructor(scope: Construct, id: string, props: LogForwardingSetupProps) {
    this.logRetentionDays = props.logRetentionDays || logs.RetentionDays.ONE_WEEK

    // Determine destination name based on account ID and stage
    this.destinationName = this.getDestinationName(props.account, props.stage)

    // Set up log groups and subscription filters for each Lambda function
    this.setupLogForwarding(scope, props)
  }

  /**
   * Gets the appropriate destination name based on the AWS account and stage.
   *
   * CMR account mappings:
   * - SIT: 832706493240
   * - UAT: 642155266859
   * - PROD: 621933553860
   *
   * @param {string} account - AWS Account ID
   * @param {string} stage - Deployment stage
   * @returns {string} The destination name for log forwarding
   * @private
   */
  private getDestinationName(account: string, stage: string): string {
    // Map of known CMR account IDs to their destination names
    const accountDestinations: { [key: string]: string } = {
      832706493240: '/gsfc-ngap-managed/application_logs_destination/832706493240', // SIT
      642155266859: '/gsfc-ngap-managed/application_logs_destination/642155266859', // UAT
      621933553860: '/gsfc-ngap-managed/application_logs_destination/621933553860' // PROD
    }

    // Try to find by account ID first
    if (accountDestinations[account]) {
      return accountDestinations[account]
    }

    // Fallback: try to determine by stage name
    const stageDestinations: { [key: string]: string } = {
      sit: accountDestinations['832706493240'],
      uat: accountDestinations['642155266859'],
      prod: accountDestinations['621933553860'],
      production: accountDestinations['621933553860']
    }

    const normalizedStage = stage.toLowerCase()
    if (stageDestinations[normalizedStage]) {
      return stageDestinations[normalizedStage]
    }

    // If we can't determine the environment, throw an error
    throw new Error(
      `Unable to determine log destination for account ${account} and stage ${stage}. `
      + 'Please ensure you are deploying to a valid CMR environment (SIT/UAT/PROD).'
    )
  }

  /**
   * Sets up log groups and subscription filters for all Lambda functions.
   *
   * For each Lambda function:
   * 1. Creates an explicit CloudWatch Log Group with retention policy
   * 2. Creates a Subscription Filter to forward logs to NGAP SecLog Kinesis stream
   * 3. Grants necessary permissions for log forwarding
   *
   * @param {Construct} scope - The scope in which to define constructs
   * @param {LogForwardingSetupProps} props - Configuration properties
   * @private
   */
  private setupLogForwarding(scope: Construct, props: LogForwardingSetupProps) {
    const { lambdas, prefix } = props

    // Create a role for CloudWatch Logs to assume when putting records to Kinesis
    const logsRole = new iam.Role(scope, `${prefix}-CloudWatchLogsRole`, {
      assumedBy: new iam.ServicePrincipal(`logs.${props.region}.amazonaws.com`),
      description: 'Role for CloudWatch Logs to send logs to NGAP SecLog Kinesis stream'
    })

    // Grant permission to put records to the Kinesis stream in the SecLog account
    logsRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kinesis:PutRecord', 'kinesis:PutRecords'],
        resources: [this.targetArn]
      })
    )

    // Set up log forwarding for each Lambda function
    Object.entries(lambdas).forEach(([key, lambdaFunction]) => {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9]/g, '-')

      // Create explicit log group with retention
      const logGroup = new logs.LogGroup(scope, `${sanitizedKey}-LogGroup`, {
        logGroupName: `/aws/lambda/${lambdaFunction.functionName}`,
        retention: this.logRetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      })

      // Create subscription filter to forward logs directly to Kinesis stream
      // No need for a CfnDestination - we can subscribe directly to the cross-account Kinesis stream
      const subscriptionFilter = new logs.CfnSubscriptionFilter(
        scope,
        `${sanitizedKey}-SplunkSubscription`,
        {
          logGroupName: logGroup.logGroupName,
          filterPattern: '', // Empty pattern forwards all logs
          destinationArn: this.targetArn,
          roleArn: logsRole.roleArn
        }
      )

      // Ensure proper dependency order
      subscriptionFilter.node.addDependency(logGroup)
    })
  }
}
