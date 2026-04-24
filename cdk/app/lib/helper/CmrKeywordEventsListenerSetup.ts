import * as path from 'path'

import * as cdk from 'aws-cdk-lib'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

import { NODE_LAMBDA_RUNTIME } from './NodeLambdaRuntime'

/**
 * Properties for the CMR keyword events listener infrastructure.
 */
interface CmrKeywordEventsListenerSetupProps {
  prefix: string
  stage: string
  keywordEventsTopic: sns.ITopic
  metadataCorrectionRequestsTopic: sns.ITopic
}

/**
 * Creates the CMR keyword events queue, listener Lambda, and related wiring.
 */
export class CmrKeywordEventsListenerSetup extends Construct {
  public readonly queue: sqs.Queue

  public readonly listenerLambda: NodejsFunction

  /**
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Construct identifier.
   * @param {CmrKeywordEventsListenerSetupProps} props - Listener configuration.
   */
  constructor(scope: Construct, id: string, props: CmrKeywordEventsListenerSetupProps) {
    super(scope, id)

    const queueName = `${props.prefix}-${props.stage}-cmr-keyword-events`
    const projectRoot = path.join(__dirname, '../../../..')

    this.queue = new sqs.Queue(this, 'CmrKeywordEventsQueue', {
      queueName
    })

    props.keywordEventsTopic.addSubscription(new subscriptions.SqsSubscription(this.queue))

    this.listenerLambda = new NodejsFunction(this, `${props.prefix}-cmr-keyword-events-processor`, {
      functionName: `${props.prefix}-${props.stage}-cmr-keyword-events-processor`,
      entry: path.join(projectRoot, 'serverless/src/cmrKeywordEventsListener/handler.js'),
      handler: 'cmrKeywordEventsListener',
      runtime: NODE_LAMBDA_RUNTIME,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      environment: {
        METADATA_CORRECTION_REQUESTS_TOPIC_ARN: props.metadataCorrectionRequestsTopic.topicArn
      },
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      projectRoot
    })

    this.listenerLambda.addEventSource(new eventsources.SqsEventSource(this.queue, {
      batchSize: 1
    }))

    this.queue.grantConsumeMessages(this.listenerLambda)
    props.metadataCorrectionRequestsTopic.grantPublish(this.listenerLambda)

    new cdk.CfnOutput(this, 'CmrKeywordEventsQueueUrl', {
      description: 'Queue URL for CMR keyword event processing',
      exportName: `${props.prefix}-CmrKeywordEventsQueueUrl`,
      value: this.queue.queueUrl
    })
  }
}
