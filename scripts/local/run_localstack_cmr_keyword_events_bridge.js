import {
  CreateTopicCommand,
  ListSubscriptionsByTopicCommand,
  SNSClient,
  SubscribeCommand
} from '@aws-sdk/client-sns'
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SetQueueAttributesCommand,
  SQSClient
} from '@aws-sdk/client-sqs'

import { cmrKeywordEventsListener } from '../../serverless/src/cmrKeywordEventsListener/handler'

/**
 * Local bridge that fills the gap between LocalStack-managed SNS/SQS and SAM-managed Lambdas.
 *
 * In AWS, SQS event source mappings wake the consumer Lambda automatically when a message
 * arrives on the queue. In the local SAM flow we only run the API Lambdas, so there is no
 * built-in process polling LocalStack SQS and invoking the CMR consumer handler. This script
 * provides that missing glue by:
 * 1. ensuring the LocalStack SNS topic and SQS queue exist
 * 2. subscribing the queue to the topic
 * 3. polling the queue
 * 4. forwarding received records into the real CMR event handler
 */
const prefix = process.env.STACK_PREFIX || 'kms'
const stage = process.env.STAGE_NAME || 'dev'
const localstackPort = process.env.LOCALSTACK_PORT || '4566'
const endpoint = process.env.LOCALSTACK_HOST_ENDPOINT || `http://localhost:${localstackPort}`
const region = 'us-east-1'
const credentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test'
}

const topicName = `${prefix}-${stage}-keyword-events`
const queueName = `${prefix}-${stage}-cmr-keyword-events`

const snsClient = new SNSClient({
  endpoint,
  region,
  credentials
})

const sqsClient = new SQSClient({
  endpoint,
  region,
  credentials
})

let shuttingDown = false

/**
 * Creates the SNS topic, SQS queue, queue policy, and subscription needed for local event flow.
 *
 * This mirrors the infrastructure relationship that exists in AWS so the local bridge can
 * observe the same SNS -> SQS delivery path before invoking the SAM-side consumer handler.
 *
 * @returns {Promise<{queueArn: string, queueUrl: string, topicArn: string}>} LocalStack resource metadata.
 */
const ensureLocalResources = async () => {
  const { TopicArn: topicArn } = await snsClient.send(new CreateTopicCommand({
    Name: topicName
  }))

  const { QueueUrl: queueUrl } = await sqsClient.send(new CreateQueueCommand({
    QueueName: queueName
  }))

  const queueAttributes = await sqsClient.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['QueueArn']
  }))

  const queueArn = queueAttributes.Attributes?.QueueArn

  const queuePolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowSnsSendMessage',
        Effect: 'Allow',
        Principal: {
          Service: 'sns.amazonaws.com'
        },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: {
          ArnEquals: {
            'aws:SourceArn': topicArn
          }
        }
      }
    ]
  }

  await sqsClient.send(new SetQueueAttributesCommand({
    QueueUrl: queueUrl,
    Attributes: {
      Policy: JSON.stringify(queuePolicy)
    }
  }))

  const existingSubscriptions = await snsClient.send(new ListSubscriptionsByTopicCommand({
    TopicArn: topicArn
  }))

  const queueAlreadySubscribed = existingSubscriptions.Subscriptions?.some(
    (subscription) => subscription.Endpoint === queueArn
  )

  if (!queueAlreadySubscribed) {
    await snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: queueArn
    }))
  }

  return {
    queueArn,
    queueUrl,
    topicArn
  }
}

/**
 * Polls the LocalStack queue and forwards each delivered SNS message into the local CMR handler.
 *
 * This is intentionally implemented outside SAM because `sam local start-api` does not emulate
 * SQS event source mappings. Successful handler execution deletes the message so local retries
 * behave similarly to Lambda acknowledging the batch in AWS.
 *
 * @param {{queueUrl: string}} params - Queue configuration for the polling loop.
 * @returns {Promise<void>}
 */
const startPolling = async ({ queueUrl }) => {
  if (shuttingDown) {
    return
  }

  const response = await sqsClient.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
    VisibilityTimeout: 30,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All']
  }))

  const message = response.Messages?.[0]

  if (message) {
    try {
      await cmrKeywordEventsListener({
        Records: [
          {
            body: message.Body,
            messageId: message.MessageId
          }
        ]
      })

      if (message.ReceiptHandle) {
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle
        }))
      }
    } catch (error) {
      console.error('[local-cmr-consumer] Failed to process queue message', error)
    }
  }

  await startPolling({
    queueUrl
  })
}

process.on('SIGINT', () => {
  shuttingDown = true
})

process.on('SIGTERM', () => {
  shuttingDown = true
})

/**
 * Starts the LocalStack bridge and keeps polling until the process is terminated.
 *
 * @returns {Promise<void>}
 */
const main = async () => {
  const resources = await ensureLocalResources()

  console.log('[localstack-cmr-bridge] Listening for keyword events', JSON.stringify(resources))

  await startPolling({
    queueUrl: resources.queueUrl
  })
}

main().catch((error) => {
  console.error('[localstack-cmr-bridge] Failed to start LocalStack bridge', error)
  process.exit(1)
})
