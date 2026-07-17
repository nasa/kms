#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  CreateTopicCommand,
  DeleteTopicCommand,
  ListTopicsCommand,
  SNSClient,
  SubscribeCommand
} from '@aws-sdk/client-sns'
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ListQueuesCommand,
  ReceiveMessageCommand,
  SetQueueAttributesCommand,
  SQSClient
} from '@aws-sdk/client-sqs'

/**
 * Local end-to-end smoke for the async metadata-correction request endpoint.
 *
 * This smoke drives the real `requestMetadataCorrection` API handler with an
 * API-Gateway-like event, publishes to a temporary FIFO SNS topic in
 * LocalStack, and verifies a subscribed FIFO SQS queue receives one deduped
 * message per collection concept id.
 *
 * What this proves:
 * - the new async endpoint accepts one or more concept ids
 * - duplicate ids are deduplicated while preserving accepted response order
 * - one publish happens per accepted collection concept id
 * - the published payload matches the async consumer contract
 * - FIFO message groups are keyed by collection concept id
 *
 * Prerequisites:
 * - LocalStack is running on `http://127.0.0.1:4566`
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_request_metadata_correction_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const outputDir = path.resolve(rootDir, 'tmp/request-metadata-correction-smoke')
const outputPath = path.resolve(outputDir, 'result.json')
const region = process.env.AWS_REGION || 'us-east-1'
const localstackEndpoint = process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566'
const smokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const topicName = `kms-dev-request-metadata-correction-smoke-${smokeId}.fifo`
const queueName = `kms-dev-request-metadata-correction-smoke-${smokeId}.fifo`
const queueReceiveTimeoutMs = Number(process.env.QUEUE_RECEIVE_TIMEOUT_MS || '15000')

const requestCollectionConceptIds = (
  process.env.COLLECTION_CONCEPT_IDS
    ? process.env.COLLECTION_CONCEPT_IDS.split(',')
    : ['C1234567890-PROV', ' C0987654321-PROV ', 'C1234567890-PROV']
).map((value) => String(value))

const expectedAcceptedCollectionConceptIds = [
  ...new Set(requestCollectionConceptIds.map((value) => value.trim()))
]

const snsClient = new SNSClient({
  endpoint: localstackEndpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

const sqsClient = new SQSClient({
  endpoint: localstackEndpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

/**
 * Sleeps for a short interval while polling LocalStack resources.
 *
 * @param {number} ms Milliseconds to pause.
 * @returns {Promise<void>} Resolves after the delay.
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

/**
 * Waits for LocalStack SNS and SQS APIs to start responding.
 *
 * @param {number} [attempt=1] Current retry attempt.
 * @returns {Promise<void>} Resolves when LocalStack is reachable.
 */
const waitForLocalStack = async (attempt = 1) => {
  try {
    await snsClient.send(new ListTopicsCommand({}))
    await sqsClient.send(new ListQueuesCommand({}))

    return
  } catch {
    // Keep polling until LocalStack comes up.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for LocalStack endpoint: ${localstackEndpoint}`)
  }

  await sleep(250)
  await waitForLocalStack(attempt + 1)
}

/**
 * Builds the SQS queue policy that allows the temporary SNS topic to publish.
 *
 * @param {Object} params Policy inputs.
 * @param {string} params.queueArn Queue ARN.
 * @param {string} params.topicArn Topic ARN.
 * @returns {string} Serialized queue policy JSON.
 */
const buildQueuePolicy = ({
  queueArn,
  topicArn
}) => JSON.stringify({
  Version: '2012-10-17',
  Statement: [{
    Sid: 'AllowMetadataCorrectionSmokeTopic',
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
  }]
})

/**
 * Parses either a raw SNS-to-SQS message body or the default SNS envelope body.
 *
 * @param {string} body SQS message body.
 * @returns {Object} Parsed metadata correction request payload.
 */
const parsePublishedRequestBody = (body) => {
  const parsedBody = JSON.parse(body)

  if (typeof parsedBody?.Message === 'string') {
    return JSON.parse(parsedBody.Message)
  }

  return parsedBody
}

/**
 * Polls the subscribed queue until the expected number of messages arrive.
 *
 * @param {Object} params Polling parameters.
 * @param {string} params.queueUrl Queue URL.
 * @param {number} params.expectedCount Expected message count.
 * @returns {Promise<Array<Object>>} Received SQS messages.
 */
const waitForMessages = async ({
  queueUrl,
  expectedCount,
  deadlineMs = Date.now() + queueReceiveTimeoutMs,
  receivedMessages = [],
  seenReceiptHandles = new Set()
}) => {
  if (Date.now() >= deadlineMs || receivedMessages.length >= expectedCount) {
    return receivedMessages
  }

  const response = await sqsClient.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 2,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All']
  }))

  const messages = response.Messages || []

  messages.forEach((message) => {
    if (!seenReceiptHandles.has(message.ReceiptHandle)) {
      seenReceiptHandles.add(message.ReceiptHandle)
      receivedMessages.push(message)
    }
  })

  return waitForMessages({
    queueUrl,
    expectedCount,
    deadlineMs,
    receivedMessages,
    seenReceiptHandles
  })
}

let topicArn
let queueUrl

try {
  await waitForLocalStack()

  const createTopicResponse = await snsClient.send(new CreateTopicCommand({
    Name: topicName,
    Attributes: {
      FifoTopic: 'true',
      ContentBasedDeduplication: 'true'
    }
  }))

  topicArn = createTopicResponse.TopicArn

  if (!topicArn) {
    throw new Error(`Failed to create smoke SNS topic for ${topicName}`)
  }

  const createQueueResponse = await sqsClient.send(new CreateQueueCommand({
    QueueName: queueName,
    Attributes: {
      FifoQueue: 'true',
      ContentBasedDeduplication: 'true'
    }
  }))

  queueUrl = createQueueResponse.QueueUrl

  if (!queueUrl) {
    throw new Error(`Failed to create smoke SQS queue for ${queueName}`)
  }

  const queueAttributesResponse = await sqsClient.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['QueueArn']
  }))

  const queueArn = queueAttributesResponse.Attributes?.QueueArn

  if (!queueArn) {
    throw new Error(`Failed to resolve QueueArn for ${queueName}`)
  }

  await sqsClient.send(new SetQueueAttributesCommand({
    QueueUrl: queueUrl,
    Attributes: {
      Policy: buildQueuePolicy({
        queueArn,
        topicArn
      })
    }
  }))

  await snsClient.send(new SubscribeCommand({
    TopicArn: topicArn,
    Protocol: 'sqs',
    Endpoint: queueArn,
    Attributes: {
      RawMessageDelivery: 'true'
    }
  }))

  process.env.AWS_ENDPOINT_URL = localstackEndpoint
  process.env.METADATA_CORRECTION_REQUESTS_TOPIC_ARN = topicArn

  const { requestMetadataCorrection } = await import('../../serverless/src/requestMetadataCorrection/handler')

  const response = await requestMetadataCorrection({
    body: JSON.stringify({
      collectionConceptIds: requestCollectionConceptIds
    })
  }, {})

  if (response.statusCode !== 202) {
    throw new Error(
      'Expected 202 response from requestMetadataCorrection, '
      + `received ${response.statusCode}: ${response.body}`
    )
  }

  const responseBody = JSON.parse(response.body)

  if (responseBody.requestedCount !== requestCollectionConceptIds.length) {
    throw new Error(
      `Expected requestedCount=${requestCollectionConceptIds.length}, `
      + `received ${responseBody.requestedCount}`
    )
  }

  if (responseBody.acceptedCount !== expectedAcceptedCollectionConceptIds.length) {
    throw new Error(
      `Expected acceptedCount=${expectedAcceptedCollectionConceptIds.length}, `
      + `received ${responseBody.acceptedCount}`
    )
  }

  const acceptedCollectionConceptIds = responseBody.accepted
    .map(({ collectionConceptId }) => collectionConceptId)

  if (
    JSON.stringify(acceptedCollectionConceptIds)
    !== JSON.stringify(expectedAcceptedCollectionConceptIds)
  ) {
    throw new Error(
      'Expected accepted collectionConceptIds to preserve trimmed first-seen order. '
      + `Expected=${JSON.stringify(expectedAcceptedCollectionConceptIds)} `
      + `Received=${JSON.stringify(acceptedCollectionConceptIds)}`
    )
  }

  responseBody.accepted.forEach((acceptedEntry) => {
    if (!acceptedEntry?.messageId) {
      throw new Error(
        `Expected messageId in accepted response entry: ${JSON.stringify(acceptedEntry)}`
      )
    }

    if (acceptedEntry.messageGroupId !== acceptedEntry.collectionConceptId) {
      throw new Error(
        'Expected messageGroupId to equal collectionConceptId in accepted response entry. '
        + `Received=${JSON.stringify(acceptedEntry)}`
      )
    }
  })

  const receivedMessages = await waitForMessages({
    queueUrl,
    expectedCount: expectedAcceptedCollectionConceptIds.length
  })

  if (receivedMessages.length !== expectedAcceptedCollectionConceptIds.length) {
    throw new Error(
      `Expected ${expectedAcceptedCollectionConceptIds.length} published SQS messages, `
      + `received ${receivedMessages.length}`
    )
  }

  const parsedMessages = receivedMessages.map((message) => ({
    messageId: message.MessageId,
    messageGroupId: message.Attributes?.MessageGroupId,
    body: parsePublishedRequestBody(message.Body || '{}')
  }))

  const receivedCollectionConceptIds = parsedMessages
    .map(({ body }) => body.collectionConceptId)
    .sort()
  const expectedSortedCollectionConceptIds = [...expectedAcceptedCollectionConceptIds].sort()

  if (
    JSON.stringify(receivedCollectionConceptIds)
    !== JSON.stringify(expectedSortedCollectionConceptIds)
  ) {
    throw new Error(
      'Expected published collectionConceptIds to match deduplicated request ids. '
      + `Expected=${JSON.stringify(expectedSortedCollectionConceptIds)} `
      + `Received=${JSON.stringify(receivedCollectionConceptIds)}`
    )
  }

  const requestedAtValues = [
    ...new Set(parsedMessages.map(({ body }) => body.requestedAt))
  ]

  if (requestedAtValues.length !== 1) {
    throw new Error(
      `Expected exactly one shared requestedAt timestamp, received ${requestedAtValues.length}`
    )
  }

  parsedMessages.forEach(({ body, messageGroupId }) => {
    if (body.source !== 'metadataCorrectionApi') {
      throw new Error(
        `Expected published source=metadataCorrectionApi, received ${body.source}`
      )
    }

    if (!expectedAcceptedCollectionConceptIds.includes(body.collectionConceptId)) {
      throw new Error(
        `Unexpected published collectionConceptId=${body.collectionConceptId}`
      )
    }

    if (messageGroupId && messageGroupId !== body.collectionConceptId) {
      throw new Error(
        `Expected SQS MessageGroupId=${body.collectionConceptId}, received ${messageGroupId}`
      )
    }
  })

  const result = {
    localstackEndpoint,
    topicArn,
    queueUrl,
    requestCollectionConceptIds,
    expectedAcceptedCollectionConceptIds,
    responseBody,
    parsedMessages,
    outputPath
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8')

  console.log('[request-metadata-correction-smoke] Completed successfully')
  console.log(JSON.stringify({
    requestedCount: responseBody.requestedCount,
    acceptedCount: responseBody.acceptedCount,
    acceptedCollectionConceptIds,
    topicArn,
    queueUrl,
    outputPath
  }, null, 2))
} finally {
  if (topicArn) {
    await snsClient.send(new DeleteTopicCommand({
      TopicArn: topicArn
    })).catch(() => {})
  }

  if (queueUrl) {
    await sqsClient.send(new DeleteQueueCommand({
      QueueUrl: queueUrl
    })).catch(() => {})
  }
}
