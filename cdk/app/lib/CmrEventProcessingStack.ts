/* eslint-disable no-new */
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
  logDestinationArn: string
}

/**
 * Stack responsible for consuming keyword events on the CMR side.
 *
 * It subscribes an SQS queue to the KMS keyword events topic and attaches the Lambda
 * that will process those events for downstream CMR business logic.
 */
export class CmrEventProcessingStack extends cdk.Stack {
  /**
   * Creates the CMR listener resources and metadata correction messaging resources.
   *
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Stack identifier.
   * @param {CmrEventProcessingStackProps} props - Stack configuration.
   */
  constructor(scope: Construct, id: string, props: CmrEventProcessingStackProps) {
    super(scope, id, props)

    const useLocalstack = this.node.tryGetContext('useLocalstack') === 'true'
    const queueName = `${props.prefix}-${props.stage}-cmr-keyword-events`
    const metadataCorrectionRequestsBaseName = `${props.prefix}-${props.stage}-metadata-correction-requests`
    const metadataCorrectionRequestsName = `${metadataCorrectionRequestsBaseName}.fifo`
    const topic = sns.Topic.fromTopicArn(this, 'KeywordEventsTopic', props.topicArn)

    const queue = new sqs.Queue(this, 'CmrKeywordEventsQueue', {
      queueName
    })

    topic.addSubscription(new subscriptions.SqsSubscription(queue))

    // TODO: Create a follow-up ticket for DLQ handling. This DLQ is only the
    // redrive target today; before adding a consumer, decide whether failures
    // should be alarmed on, manually inspected, or redriven by an operator.
    const metadataCorrectionRequestsDlq = new sqs.Queue(this, 'MetadataCorrectionRequestsDlq', {
      queueName: `${metadataCorrectionRequestsBaseName}-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(14)
    })

    const metadataCorrectionRequestsQueue = new sqs.Queue(this, 'MetadataCorrectionRequestsQueue', {
      queueName: metadataCorrectionRequestsName,
      fifo: true,
      contentBasedDeduplication: true,
      deadLetterQueue: {
        queue: metadataCorrectionRequestsDlq,
        maxReceiveCount: 3
      },
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.minutes(5)
    })

    const metadataCorrectionRequestsTopic = new sns.Topic(this, 'MetadataCorrectionRequestsTopic', {
      contentBasedDeduplication: true,
      fifo: true,
      topicName: metadataCorrectionRequestsName
    })

    metadataCorrectionRequestsTopic.addSubscription(new subscriptions.SqsSubscription(
      metadataCorrectionRequestsQueue,
      {
        rawMessageDelivery: true
      }
    ))

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
      environment: {
        METADATA_CORRECTION_REQUESTS_TOPIC_ARN: metadataCorrectionRequestsTopic.topicArn
      },
      depsLockFilePath: path.join(__dirname, '../../../package-lock.json'),
      projectRoot: path.join(__dirname, '../../..')
    })

    const metadataCorrectionServiceRole = new iam.Role(this, 'MetadataCorrectionServiceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    })

    const metadataCorrectionServiceLambda = new NodejsFunction(
      this,
      `${props.prefix}-metadata-correction-service`,
      {
        functionName: `${props.prefix}-${props.stage}-metadata-correction-service`,
        entry: path.join(__dirname, '../../../serverless/src/metadataCorrectionService/handler.js'),
        handler: 'metadataCorrectionService',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        role: metadataCorrectionServiceRole,
        depsLockFilePath: path.join(__dirname, '../../../package-lock.json'),
        projectRoot: path.join(__dirname, '../../..')
      }
    )

    listenerLambda.addEventSource(new eventsources.SqsEventSource(queue, {
      batchSize: 1
    }))

    metadataCorrectionServiceLambda.addEventSource(new eventsources.SqsEventSource(
      metadataCorrectionRequestsQueue,
      {
        batchSize: 1
      }
    ))

    queue.grantConsumeMessages(listenerLambda)
    metadataCorrectionRequestsTopic.grantPublish(listenerLambda)
    metadataCorrectionRequestsQueue.grantConsumeMessages(metadataCorrectionServiceLambda)

    // Set up CloudWatch Logs forwarding to Splunk via NGAP SecLog account
    // Skip log forwarding for localstack deployments
    if (!useLocalstack) {
      // eslint-disable-next-line no-new
      new LogForwardingSetup(this, 'LogForwarding', {
        prefix: props.prefix,
        stage: props.stage,
        logDestinationArn: props.logDestinationArn,
        lambdas: {
          'cmrKeywordEventsListener/handler.js::cmr-keyword-events-processor': listenerLambda,
          'metadataCorrectionService/handler.js::metadata-correction-service': metadataCorrectionServiceLambda
        }
      })
    }

    new cdk.CfnOutput(this, 'CmrKeywordEventsQueueUrl', {
      description: 'Queue URL for CMR keyword event processing',
      exportName: `${props.prefix}-CmrKeywordEventsQueueUrl`,
      value: queue.queueUrl
    })

    new cdk.CfnOutput(
      this,
      'MetadataCorrectionRequestsTopicArn',
      {
        description: 'SNS topic ARN for metadata correction request publishing',
        exportName: `${props.prefix}-MetadataCorrectionRequestsTopicArn`,
        value: metadataCorrectionRequestsTopic.topicArn
      }
    )

    new cdk.CfnOutput(
      this,
      'MetadataCorrectionRequestsQueueUrl',
      {
        description: 'Queue URL for metadata correction request processing',
        exportName: `${props.prefix}-MetadataCorrectionRequestsQueueUrl`,
        value: metadataCorrectionRequestsQueue.queueUrl
      }
    )

    new cdk.CfnOutput(
      this,
      'MetadataCorrectionRequestsQueueArn',
      {
        description: 'Queue ARN for metadata correction request processing',
        exportName: `${props.prefix}-MetadataCorrectionRequestsQueueArn`,
        value: metadataCorrectionRequestsQueue.queueArn
      }
    )

    new cdk.CfnOutput(
      this,
      'MetadataCorrectionRequestsDlqUrl',
      {
        description: 'DLQ URL for failed metadata correction request processing',
        exportName: `${props.prefix}-MetadataCorrectionRequestsDlqUrl`,
        value: metadataCorrectionRequestsDlq.queueUrl
      }
    )

    new cdk.CfnOutput(
      this,
      'MetadataCorrectionRequestsDlqArn',
      {
        description: 'DLQ ARN for failed metadata correction request processing',
        exportName: `${props.prefix}-MetadataCorrectionRequestsDlqArn`,
        value: metadataCorrectionRequestsDlq.queueArn
      }
    )
  }
}
