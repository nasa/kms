import * as cdk from 'aws-cdk-lib'
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
  /** ARN of the log destination in NGAP SecLog account */
  logDestinationArn: string
  /** Map of Lambda functions to configure log forwarding for */
  lambdas: { [key: string]: lambda.Function }
  /** Log retention period in days */
  logRetentionDays?: logs.RetentionDays
}

/**
 * Sets up CloudWatch Log Groups and Subscription Filters to forward logs to NGAP SecLog account.
 *
 * This class configures log forwarding to Splunk via NGAP's centralized logging infrastructure.
 * Logs are forwarded to a Kinesis stream in the SecLog account which then forwards them to Splunk.
 *
 * @see https://wiki.earthdata.nasa.gov/pages/viewpage.action?pageId=147423378
 */
export class LogForwardingSetup {
  /** The ARN of the log destination for log forwarding */
  private readonly logDestinationArn: string

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

    if (!props.logDestinationArn) {
      throw new Error(
        'logDestinationArn is required for log forwarding. '
        + 'Please set the LOG_DESTINATION_ARN environment variable in your Bamboo deployment.'
      )
    }

    this.logDestinationArn = props.logDestinationArn

    // Set up log groups and subscription filters for each Lambda function
    this.setupLogForwarding(scope, props)
  }

  /**
   * Sets up log groups and subscription filters for all Lambda functions.
   *
   * For each Lambda function:
   * 1. Creates an explicit CloudWatch Log Group with retention policy
   * 2. Creates a Subscription Filter to forward logs to NGAP SecLog destination
   *
   * Note: We use the pre-configured destination ARN in the SecLog account,
   * not a role from our account. The destination already has the necessary
   * permissions to receive logs from our account.
   *
   * @param {Construct} scope - The scope in which to define constructs
   * @param {LogForwardingSetupProps} props - Configuration properties
   * @private
   */
  private setupLogForwarding(scope: Construct, props: LogForwardingSetupProps) {
    const { lambdas } = props

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

      // Create subscription filter to forward logs to NGAP SecLog destination
      // The destination ARN is pre-configured in the SecLog account and has
      // the necessary permissions to accept logs from our account
      const subscriptionFilter = new logs.CfnSubscriptionFilter(
        scope,
        `${sanitizedKey}-subscriptionFilter`,
        {
          logGroupName: logGroup.logGroupName,
          filterPattern: '', // Empty pattern forwards all logs
          destinationArn: this.logDestinationArn
          // No roleArn needed - the destination is in the SecLog account
        }
      )

      // Ensure proper dependency order
      subscriptionFilter.node.addDependency(logGroup)
    })
  }
}
