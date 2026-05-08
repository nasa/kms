import * as path from 'path'

import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
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
  cmrBaseUrl: string
  cmrLbUrl?: string
  prefix: string
  redisEnabled?: string
  redisHost?: string
  redisPort?: string
  securityGroup: ec2.SecurityGroup
  stage: string
  useLocalstack: boolean
  vpc: ec2.IVpc
}

/**
 * Creates the metadata correction SNS/SQS/Lambda plumbing and exports its endpoints.
 */
export class MetadataCorrectionSetup extends Construct {
  public readonly metadataCorrectionRequestsTopic: sns.Topic

  public readonly metadataCorrectionRequestsQueue: sqs.Queue

  public readonly metadataCorrectionRequestsDlq: sqs.Queue

  public readonly metadataCorrectionServiceLambda: NodejsFunction

  public readonly metadataCorrectionRequestsTopicArnOutput: cdk.CfnOutput

  public readonly metadataCorrectionRequestsQueueUrlOutput: cdk.CfnOutput

  public readonly metadataCorrectionRequestsQueueArnOutput: cdk.CfnOutput

  public readonly metadataCorrectionRequestsDlqUrlOutput: cdk.CfnOutput

  public readonly metadataCorrectionRequestsDlqArnOutput: cdk.CfnOutput

  /**
   * @param {Construct} scope - Parent construct.
   * @param {string} id - Construct identifier.
   * @param {MetadataCorrectionSetupProps} props - Metadata correction configuration.
   */
  constructor(scope: Construct, id: string, props: MetadataCorrectionSetupProps) {
    super(scope, id)

    const {
      cmrBaseUrl,
      cmrLbUrl,
      prefix,
      redisEnabled,
      redisHost,
      redisPort,
      securityGroup,
      stage,
      useLocalstack,
      vpc
    } = props

    const metadataCorrectionRequestsBaseName = `${prefix}-${stage}-metadata-correction-requests`
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
      `${prefix}-metadata-correction-service`,
      {
        functionName: `${prefix}-${stage}-metadata-correction-service`,
        entry: path.join(projectRoot, 'serverless/src/metadataCorrectionService/handler.js'),
        handler: 'metadataCorrectionService',
        runtime: NODE_LAMBDA_RUNTIME,
        timeout: cdk.Duration.seconds(30),
        memorySize: 1024,
        environment: {
          CMR_BASE_URL: cmrBaseUrl,
          ...(cmrLbUrl ? { CMR_LB_URL: cmrLbUrl } : {}),
          ...(redisEnabled ? { REDIS_ENABLED: redisEnabled } : {}),
          ...(redisHost ? { REDIS_HOST: redisHost } : {}),
          ...(redisPort ? { REDIS_PORT: redisPort } : {})
        },
        depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
        projectRoot,
        ...(useLocalstack ? {} : {
          vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
          },
          securityGroups: [securityGroup]
        })
      }
    )

    this.metadataCorrectionServiceLambda.addEventSource(new eventsources.SqsEventSource(
      this.metadataCorrectionRequestsQueue,
      {
        batchSize: 1
      }
    ))

    this.metadataCorrectionRequestsQueue.grantConsumeMessages(this.metadataCorrectionServiceLambda)

    this.metadataCorrectionRequestsTopicArnOutput = new cdk.CfnOutput(this, 'MetadataCorrectionRequestsTopicArn', {
      description: 'SNS topic ARN for metadata correction request publishing',
      exportName: `${prefix}-MetadataCorrectionRequestsTopicArn`,
      value: this.metadataCorrectionRequestsTopic.topicArn
    })

    this.metadataCorrectionRequestsQueueUrlOutput = new cdk.CfnOutput(this, 'MetadataCorrectionRequestsQueueUrl', {
      description: 'Queue URL for metadata correction request processing',
      exportName: `${prefix}-MetadataCorrectionRequestsQueueUrl`,
      value: this.metadataCorrectionRequestsQueue.queueUrl
    })

    this.metadataCorrectionRequestsQueueArnOutput = new cdk.CfnOutput(this, 'MetadataCorrectionRequestsQueueArn', {
      description: 'Queue ARN for metadata correction request processing',
      exportName: `${prefix}-MetadataCorrectionRequestsQueueArn`,
      value: this.metadataCorrectionRequestsQueue.queueArn
    })

    this.metadataCorrectionRequestsDlqUrlOutput = new cdk.CfnOutput(this, 'MetadataCorrectionRequestsDlqUrl', {
      description: 'DLQ URL for failed metadata correction request processing',
      exportName: `${prefix}-MetadataCorrectionRequestsDlqUrl`,
      value: this.metadataCorrectionRequestsDlq.queueUrl
    })

    this.metadataCorrectionRequestsDlqArnOutput = new cdk.CfnOutput(this, 'MetadataCorrectionRequestsDlqArn', {
      description: 'DLQ ARN for failed metadata correction request processing',
      exportName: `${prefix}-MetadataCorrectionRequestsDlqArn`,
      value: this.metadataCorrectionRequestsDlq.queueArn
    })
  }
}
