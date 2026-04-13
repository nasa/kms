import * as path from 'path'

import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

import { LogForwardingSetup } from './helper/LogForwardingSetup'

/**
 * Properties for the CMR event processing stack.
 */
export interface CmrEventProcessingStackProps extends cdk.StackProps {
  prefix: string
  stage: string
  topicArn: string
  logDestinationAccount?: string
  secLogAccount?: string
}

/**
 * Stack responsible for consuming keyword events on the CMR side.
 *
 * It subscribes an SQS queue to the KMS keyword events topic and attaches the Lambda
 * that will process those events for downstream CMR business logic.
 */
export class CmrEventProcessingStack extends cdk.Stack {
  public readonly keywordEventsQueueUrlOutput: cdk.CfnOutput

  /**
   * Creates the CMR queue, subscription, listener, and queue output.
   *
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Stack identifier.
   * @param {CmrEventProcessingStackProps} props - Stack configuration.
   */
  constructor(scope: Construct, id: string, props: CmrEventProcessingStackProps) {
    super(scope, id, props)

    const queueName = `${props.prefix}-${props.stage}-cmr-keyword-events`
    const topic = sns.Topic.fromTopicArn(this, 'KeywordEventsTopic', props.topicArn)

    const queue = new sqs.Queue(this, 'CmrKeywordEventsQueue', {
      queueName
    })

    topic.addSubscription(new subscriptions.SqsSubscription(queue))

    const listenerRole = new iam.Role(this, 'CmrKeywordEventsProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    })

    const listenerLambda = new NodejsFunction(this, `${props.prefix}-cmr-keyword-events-processor`, {
      functionName: `${props.prefix}-${props.stage}-cmr-keyword-events-processor`,
      entry: path.join(__dirname, '../../../serverless/src/cmrKeywordEventsListener/handler.js'),
      handler: 'cmrKeywordEventsListener',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      role: listenerRole,
      depsLockFilePath: path.join(__dirname, '../../../package-lock.json'),
      projectRoot: path.join(__dirname, '../../..')
    })

    listenerLambda.addEventSource(new eventsources.SqsEventSource(queue, {
      batchSize: 1
    }))

    queue.grantConsumeMessages(listenerLambda)

    // Set up CloudWatch Logs forwarding to Splunk via NGAP SecLog account
    // Create log forwarding setup - no reference needed as it registers itself
    // eslint-disable-next-line no-new
    new LogForwardingSetup(this, 'LogForwarding', {
      prefix: props.prefix,
      stage: props.stage,
      account: props.logDestinationAccount || this.account,
      region: this.region,
      secLogAccount: props.secLogAccount || '353585529927',
      lambdas: {
        'cmrKeywordEventsListener/handler.js::cmr-keyword-events-processor': listenerLambda
      }
    })

    this.keywordEventsQueueUrlOutput = new cdk.CfnOutput(this, 'CmrKeywordEventsQueueUrl', {
      description: 'Queue URL for CMR keyword event processing',
      exportName: `${props.prefix}-CmrKeywordEventsQueueUrl`,
      value: queue.queueUrl
    })
  }
}
