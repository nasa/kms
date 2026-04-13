import {
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand
} from '@aws-sdk/client-eventbridge'
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

import { logger } from '../../serverless/src/shared/logger'

/**
 * Shared naming prefix used for local resource names.
 * @type {string}
 */
const prefix = process.env.STACK_PREFIX || 'kms'

/**
 * Active local stage name used when deriving resource names.
 * @type {string}
 */
const stage = process.env.STAGE_NAME || 'dev'

/**
 * Host port exposed by the LocalStack container.
 * @type {string}
 */
const localstackPort = process.env.LOCALSTACK_PORT || '4566'

/**
 * Host-reachable LocalStack endpoint used by the bridge process.
 * @type {string}
 */
const endpoint = process.env.LOCALSTACK_HOST_ENDPOINT || `http://localhost:${localstackPort}`

/**
 * Host-reachable RDF4J endpoint used when invoking handlers outside SAM containers.
 * @type {string}
 */
const hostRdf4jServiceUrl = process.env.RDF4J_HOST_SERVICE_URL || 'http://localhost:8081'

/**
 * Host-reachable Redis hostname used when invoking handlers outside SAM containers.
 * SAM containers still use REDIS_HOST/REDIS_PORT directly.
 * @type {string}
 */
const hostRedisHost = process.env.REDIS_HOST_SERVICE_HOST || 'localhost'

/**
 * Host-reachable Redis port used when invoking handlers outside SAM containers.
 * The local Redis container publishes 6379 to host port 6380 by default.
 * @type {string}
 */
const hostRedisPort = process.env.REDIS_HOST_PORT || '6380'

/**
 * Fixed AWS region used for LocalStack service clients.
 * @type {string}
 */
const region = 'us-east-1'

/**
 * Static LocalStack credentials used for AWS SDK request signing in local development.
 * @type {{accessKeyId: string, secretAccessKey: string}}
 */
const credentials = {
  accessKeyId: 'test',
  secretAccessKey: 'test'
}

/**
 * Event bus name used by local EventBridge flows.
 * @type {string}
 */
const eventBusName = process.env.PRIME_CACHE_EVENT_BUS_NAME || 'default'

/**
 * Default bridge registrations used when the runner does not supply explicit bridge config.
 * @type {Array<{handler: string, sourceType: string, eventPattern: Object}>}
 */
const defaultBridgeRegistry = [
  {
    handler: 'publisher',
    sourceType: 'eventbridge-to-sqs',
    eventPattern: {
      source: ['kms.publish'],
      detailType: ['kms.published.version.changed']
    }
  },
  {
    handler: 'cmrKeywordEventsListener',
    sourceType: 'sns-to-sqs',
    eventPattern: {
      topicName: 'keyword-events'
    }
  },
  {
    handler: 'primeConceptsCache',
    sourceType: 'eventbridge-to-sqs',
    eventPattern: {
      source: ['kms.publisher'],
      detailType: ['kms.publisher.analysis.completed']
    }
  }
]

/**
 * Loads bridge registrations from the runner-provided environment when available.
 *
 * @returns {Array<{handler: string, sourceType: string, eventPattern: Object}>}
 */
const getBridgeRegistry = () => {
  const rawRegistry = process.env.BRIDGE_REGISTRY_JSON

  if (!rawRegistry) return defaultBridgeRegistry

  return JSON.parse(rawRegistry)
}

/**
 * Shared SNS client used by the local bridge when provisioning and observing LocalStack SNS.
 * @type {SNSClient}
 */
const snsClient = new SNSClient({
  endpoint,
  region,
  credentials
})

/**
 * Shared SQS client used by the local bridge when provisioning, polling, and deleting messages.
 * @type {SQSClient}
 */
const sqsClient = new SQSClient({
  endpoint,
  region,
  credentials
})

/**
 * Shared EventBridge client used by the local bridge to create rules and targets in LocalStack.
 * @type {EventBridgeClient}
 */
const eventBridgeClient = new EventBridgeClient({
  endpoint,
  region,
  credentials
})

/**
 * Converts an SQS message containing an EventBridge event into the payload expected by the
 * locally invoked handler.
 *
 * @param {import('@aws-sdk/client-sqs').Message} message - Polled SQS message.
 * @returns {Object} Parsed EventBridge event payload.
 */
const toJsonBody = (message) => JSON.parse(message.Body || '{}')

/**
 * Converts an SQS message into the batch-shaped event used by Lambda SQS event sources.
 *
 * @param {import('@aws-sdk/client-sqs').Message} message - Polled SQS message.
 * @returns {{Records: Array<{body: string | undefined, messageId: string | undefined}>}}
 */
const toSqsLambdaEvent = (message) => ({
  Records: [
    {
      body: message.Body,
      messageId: message.MessageId
    }
  ]
})

/**
 * Maps bridge source types to the message adapter each handler expects.
 * @type {Record<string, Function>}
 */
const adapterBySourceType = {
  'eventbridge-to-sqs': toJsonBody,
  'sns-to-sqs': toSqsLambdaEvent
}

/**
 * Vite-friendly lazy import map for all serverless handler modules.
 * @type {Record<string, Function>}
 */
const handlerModuleLoaders = import.meta.glob('../../serverless/src/*/handler.js')

/**
 * Lazily resolves a handler name to `serverless/src/<handlerName>/handler` and returns the
 * matching named export after host-side environment overrides have been applied.
 *
 * @param {string} handlerName - Handler name from the registry.
 * @returns {Promise<Function>} The resolved handler function.
 */
const getBridgeHandler = async (handlerName) => {
  const moduleLoader = handlerModuleLoaders[`../../serverless/src/${handlerName}/handler.js`]

  if (!moduleLoader) {
    throw new Error(`Unable to resolve bridge handler module: ${handlerName}`)
  }

  const module = await moduleLoader()
  const handler = module[handlerName]

  if (!handler) {
    throw new Error(`Unable to resolve bridge handler export: ${handlerName}`)
  }

  return handler
}

/**
 * Ensures host-invoked handlers talk to host-reachable local services instead of Docker-only
 * service names used by SAM containers.
 */
const configureHostHandlerEnvironment = () => {
  process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId
  process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey
  process.env.AWS_REGION = region
  process.env.AWS_ENDPOINT_URL = endpoint
  process.env.PRIME_CACHE_EVENT_BUS_NAME = eventBusName
  process.env.RDF4J_SERVICE_URL = hostRdf4jServiceUrl
  process.env.REDIS_HOST = hostRedisHost
  process.env.REDIS_PORT = hostRedisPort
}

/**
 * Prefixes a logical resource name with the shared stack prefix and stage.
 *
 * @param {string} name - Logical resource name.
 * @returns {string} Fully qualified local resource name.
 */
const formatResourceName = (name) => `${prefix}-${stage}-${name}`

/**
 * Normalizes an arbitrary registration key into a safe LocalStack resource token.
 *
 * @param {string} name - Raw registration key.
 * @returns {string} Sanitized resource token.
 */
const normalizeName = (name) => name.replace(/[^a-zA-Z0-9-]/g, '-')

/**
 * Derives the stable registration key used for both resource lookup and runtime dispatch.
 *
 * @param {Object} registration - Bridge registration definition.
 * @returns {string | undefined} Derived registration key.
 */
const getRegistrationKey = (registration) => (
  registration.eventPattern?.source?.[0] || registration.eventPattern?.topicName
)

/**
 * Derives the queue resource token used by the bridge for a given registration.
 *
 * @param {Object} registration - Bridge registration definition.
 * @returns {string} Logical queue resource token.
 */
const getQueueResourceName = (registration) => (
  `${normalizeName(getRegistrationKey(registration))}-to-${normalizeName(registration.handler)}`
)

/**
 * Ensures a LocalStack queue exists and returns its URL and ARN.
 *
 * @param {string} queueName - Fully qualified queue name to create or retrieve.
 * @returns {Promise<{queueUrl: string | undefined, queueArn: string | undefined}>}
 */
const ensureQueue = async (queueName) => {
  const { QueueUrl: queueUrl } = await sqsClient.send(new CreateQueueCommand({
    QueueName: queueName
  }))

  const queueAttributes = await sqsClient.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['QueueArn']
  }))

  return {
    queueUrl,
    queueArn: queueAttributes.Attributes?.QueueArn
  }
}

/**
 * Provisions the LocalStack SNS topic, SQS queue, queue policy, and subscription for an
 * SNS-to-SQS bridge registration.
 *
 * @param {Object} registration - Bridge registration definition.
 * @returns {Promise<Object>} Created or discovered bridge resources.
 */
const ensureSnsToSqsResources = async (registration) => {
  const name = getRegistrationKey(registration)
  const topicName = formatResourceName(normalizeName(registration.eventPattern.topicName))
  const queueName = formatResourceName(getQueueResourceName(registration))
  const { TopicArn: topicArn } = await snsClient.send(new CreateTopicCommand({
    Name: topicName
  }))

  const {
    queueArn,
    queueUrl
  } = await ensureQueue(queueName)

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
    name,
    queueArn,
    queueName,
    queueUrl,
    topicArn
  }
}

/**
 * Provisions the LocalStack queue, EventBridge rule, target, and queue policy for an
 * EventBridge-to-SQS bridge registration.
 *
 * @param {Object} registration - Bridge registration definition.
 * @returns {Promise<Object>} Created or discovered bridge resources.
 */
const ensureEventBridgeToSqsResources = async (registration) => {
  const name = getRegistrationKey(registration)
  const queueName = formatResourceName(getQueueResourceName(registration))
  const ruleName = formatResourceName(`${normalizeName(name)}-to-${normalizeName(registration.handler)}`)
  const targetId = formatResourceName(`${normalizeName(name)}-target`)
  const {
    queueArn,
    queueUrl
  } = await ensureQueue(queueName)

  const { RuleArn: ruleArn } = await eventBridgeClient.send(new PutRuleCommand({
    Name: ruleName,
    EventBusName: eventBusName,
    EventPattern: JSON.stringify({
      source: registration.eventPattern?.source || [name],
      'detail-type': registration.eventPattern?.detailType || []
    }),
    State: 'ENABLED'
  }))

  const queuePolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowEventBridgeSendMessage',
        Effect: 'Allow',
        Principal: {
          Service: 'events.amazonaws.com'
        },
        Action: 'sqs:SendMessage',
        Resource: queueArn,
        Condition: {
          ArnEquals: {
            'aws:SourceArn': ruleArn
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

  await eventBridgeClient.send(new PutTargetsCommand({
    Rule: ruleName,
    EventBusName: eventBusName,
    Targets: [
      {
        Id: targetId,
        Arn: queueArn
      }
    ]
  }))

  return {
    name,
    queueArn,
    queueName,
    queueUrl,
    ruleArn
  }
}

/**
 * Provisions all LocalStack resources required by the provided bridge registrations.
 *
 * @returns {Promise<Record<string, any>>} Resources keyed by derived registration key.
 */
const ensureBridgeResources = async (bridgeRegistry) => {
  const ensureResourcesBySourceType = {
    'eventbridge-to-sqs': ensureEventBridgeToSqsResources,
    'sns-to-sqs': ensureSnsToSqsResources
  }

  const resourceEntries = await Promise.all(bridgeRegistry.map(async (registration) => {
    const ensureResources = ensureResourcesBySourceType[registration.sourceType]

    if (!ensureResources) {
      throw new Error(`Unknown bridge source type: ${registration.sourceType}`)
    }

    return [getRegistrationKey(registration), await ensureResources(registration)]
  }))

  return Object.fromEntries(resourceEntries)
}

/**
 * Starts a queue polling loop for a single bridge registration.
 *
 * @param {Object} params - Polling configuration.
 * @param {string} params.name - Registration key used in logs.
 * @param {string} params.queueUrl - Queue URL to poll.
 * @param {(message: import('@aws-sdk/client-sqs').Message) => Promise<void>} params.processMessage
 * Message processor invoked for each received message.
 * @param {{value: boolean}} params.shuttingDownRef - Shared shutdown flag.
 * @returns {Promise<void>}
 */
const startPollingLoop = async ({
  name,
  queueUrl,
  processMessage,
  shuttingDownRef
}) => {
  /* eslint-disable no-await-in-loop */
  while (!shuttingDownRef.value) {
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
        await processMessage(message)

        if (message.ReceiptHandle) {
          await sqsClient.send(new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          }))
        }
      } catch (error) {
        logger.error(`[localstack-bridge] Failed to process ${name} queue message`, error)
      }
    }
  }
  /* eslint-enable no-await-in-loop */
}

/**
 * Starts the LocalStack bridge entrypoint with the KMS local registrations.
 *
 * @returns {Promise<void>}
 */
const main = async () => {
  configureHostHandlerEnvironment()
  const bridgeRegistry = getBridgeRegistry()

  const shuttingDownRef = { value: false }
  const handleShutdown = () => {
    shuttingDownRef.value = true
  }

  process.on('SIGINT', handleShutdown)
  process.on('SIGTERM', handleShutdown)

  const resourcesByName = await ensureBridgeResources(bridgeRegistry)

  process.env.KEYWORD_EVENTS_TOPIC_ARN = resourcesByName['keyword-events'].topicArn

  logger.info('[localstack-bridge] Configured local bridge flows', {
    eventBusName,
    hostRdf4jServiceUrl,
    resourcesByName
  })

  const activeFlows = await Promise.all(bridgeRegistry.map(async (registration) => {
    const handler = await getBridgeHandler(registration.handler)
    const registrationKey = getRegistrationKey(registration)
    const toHandlerEvent = adapterBySourceType[registration.sourceType]

    if (!toHandlerEvent) {
      throw new Error(`Unknown bridge source type: ${registration.sourceType}`)
    }

    return {
      name: registrationKey,
      queueUrl: resourcesByName[registrationKey].queueUrl,
      processMessage: async (message) => handler(toHandlerEvent(message))
    }
  }))

  logger.info('[localstack-bridge] Listening for local event flow', resourcesByName)

  await Promise.all(activeFlows.map((flow) => startPollingLoop({
    ...flow,
    shuttingDownRef
  })))
}

main().catch((error) => {
  logger.error('[localstack-bridge] Failed to start LocalStack bridge', error)
  if (error?.stack) {
    console.error(error.stack)
  }

  process.exit(1)
})
