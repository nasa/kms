import * as path from 'path'

import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

import { NODE_LAMBDA_RUNTIME } from './NodeLambdaRuntime'

/**
 * Properties for metadata correction infrastructure.
 */
interface MetadataCorrectionSetupProps {
  prefix: string
  stage: string
}

/**
 * Creates the metadata correction SNS/SQS/Lambda plumbing and exports its endpoints.
 */
export class MetadataCorrectionSetup extends Construct {
  public readonly metadataCorrectionRequestsTopic: sns.Topic

  public readonly metadataCorrectionRequestsQueue: sqs.Queue

  public readonly metadataCorrectionRequestsDlq: sqs.Queue

  public readonly metadataCorrectionServiceLambda: NodejsFunction

  /**
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Construct identifier.
   * @param {MetadataCorrectionSetupProps} props - Metadata correction configuration.
   */
  constructor(scope: Construct, id: string, props: MetadataCorrectionSetupProps) {
    super(scope, id)

    const metadataCorrectionRequestsBaseName = `${props.prefix}-${props.stage}-metadata-correction-requests`
    const metadataCorrectionRequestsName = `${metadataCorrectionRequestsBaseName}.fifo`
    const projectRoot = path.join(__dirname, '../../../..')

    // TODO: Create a follow-up ticket for DLQ handling. This DLQ is only the
    // redrive target today; before adding a consumer, decide whether failures
    // should be alarmed on, manually inspected, or redriven by an operator.
    this.metadataCorrectionRequestsDlq = new sqs.Queue(this, 'MetadataCorrectionRequestsDlq', {
      queueName: `${metadataCorrectionRequestsBaseName}-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(14)
    })

    this.metadataCorrectionRequestsQueue = new sqs.Queue(this, 'MetadataCorrectionRequestsQueue', {
      queueName: metadataCorrectionRequestsName,
      fifo: true,
      contentBasedDeduplication: true,
      deadLetterQueue: {
        queue: this.metadataCorrectionRequestsDlq,
        maxReceiveCount: 3
      },
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.minutes(5)
    })

    this.metadataCorrectionRequestsTopic = new sns.Topic(this, 'MetadataCorrectionRequestsTopic', {
      contentBasedDeduplication: true,
      fifo: true,
      topicName: metadataCorrectionRequestsName
    })

    this.metadataCorrectionRequestsTopic.addSubscription(new subscriptions.SqsSubscription(
      this.metadataCorrectionRequestsQueue,
      {
        rawMessageDelivery: true
      }
    ))

    this.metadataCorrectionServiceLambda = new NodejsFunction(
      this,
      `${props.prefix}-metadata-correction-service`,
      {
        functionName: `${props.prefix}-${props.stage}-metadata-correction-service`,
        entry: path.join(projectRoot, 'serverless/src/metadataCorrectionService/handler.js'),
        handler: 'metadataCorrectionService',
        runtime: NODE_LAMBDA_RUNTIME,
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
        projectRoot
      }
    )

    this.metadataCorrectionServiceLambda.addEventSource(new eventsources.SqsEventSource(
      this.metadataCorrectionRequestsQueue,
      {
        batchSize: 1
      }
    ))

    this.metadataCorrectionRequestsQueue.grantConsumeMessages(this.metadataCorrectionServiceLambda)

    new cdk.CfnOutput(this, 'MetadataCorrectionRequestsTopicArn', {
      description: 'SNS topic ARN for metadata correction request publishing',
      exportName: `${props.prefix}-MetadataCorrectionRequestsTopicArn`,
      value: this.metadataCorrectionRequestsTopic.topicArn
    })

    new cdk.CfnOutput(this, 'MetadataCorrectionRequestsQueueUrl', {
      description: 'Queue URL for metadata correction request processing',
      exportName: `${props.prefix}-MetadataCorrectionRequestsQueueUrl`,
      value: this.metadataCorrectionRequestsQueue.queueUrl
    })

    new cdk.CfnOutput(this, 'MetadataCorrectionRequestsQueueArn', {
      description: 'Queue ARN for metadata correction request processing',
      exportName: `${props.prefix}-MetadataCorrectionRequestsQueueArn`,
      value: this.metadataCorrectionRequestsQueue.queueArn
    })

    new cdk.CfnOutput(this, 'MetadataCorrectionRequestsDlqUrl', {
      description: 'DLQ URL for failed metadata correction request processing',
      exportName: `${props.prefix}-MetadataCorrectionRequestsDlqUrl`,
      value: this.metadataCorrectionRequestsDlq.queueUrl
    })

    new cdk.CfnOutput(this, 'MetadataCorrectionRequestsDlqArn', {
      description: 'DLQ ARN for failed metadata correction request processing',
      exportName: `${props.prefix}-MetadataCorrectionRequestsDlqArn`,
      value: this.metadataCorrectionRequestsDlq.queueArn
    })
  }
}
