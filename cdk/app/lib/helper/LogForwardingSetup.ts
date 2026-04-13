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
  /** AWS Account ID for log destination */
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

    // Set destination name using the account ID from Bamboo deployment parameter
    this.destinationName = `/gsfc-ngap-managed/application_logs_destination/${props.account}`

    // Set up log groups and subscription filters for each Lambda function
    this.setupLogForwarding(scope, props)
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
      // Log group naming: /aws/lambda/{prefix}-{stage}-{functionName}
      // This enables easy Splunk searches: source="/aws/lambda/kms-sit-*"
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
