import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'

const PUBLISH_EVENT_SOURCE = 'kms.publish'
const PUBLISH_EVENT_DETAIL_TYPE = 'kms.published.version.changed'

const publishEventClient = new EventBridgeClient({})

/**
 * Emits a publish-version-changed event to EventBridge to trigger the publisher handler.
 *
 * @async
 * @param {Object} params - Event payload details.
 * @param {string} params.versionName - Published version name.
 * @param {string} params.publishDate - ISO publish timestamp.
 * @returns {Promise<void>}
 * @throws {Error} When EventBridge reports failed entries.
 */
const emitPublishEvent = async ({ versionName, publishDate }) => {
  const eventBusName = process.env.PRIME_CACHE_EVENT_BUS_NAME || 'default'

  const response = await publishEventClient.send(new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: PUBLISH_EVENT_SOURCE,
        DetailType: PUBLISH_EVENT_DETAIL_TYPE,
        Detail: JSON.stringify({
          version: 'published',
          versionName,
          publishDate
        })
      }
    ]
  }))

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    throw new Error(`Failed to emit publish event. failedEntryCount=${response.FailedEntryCount}`)
  }
}

/**
 * Initiates the publication process for a new version of the keyword set.
 *
 * This function serves as the entry point for the publish workflow and performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided in the query string.
 * 2. Emits a publish event to EventBridge with the version name and timestamp.
 * 3. Returns immediately with a 200 (OK) status indicating the process has been initiated.
 *
 * The actual publish operation (SPARQL update, keyword analysis, and cache priming) is handled
 * asynchronously by the publisher handler triggered via EventBridge.
 *
 * Note: This function does not perform the actual publish operation itself. It delegates to
 * the event-driven architecture for asynchronous processing
 *
 * @async
 * @function publish
 * @param {Object} event - The event object passed from API Gateway.
 * @param {Object} event.queryStringParameters - The query string parameters from the API request.
 * @param {string} event.queryStringParameters.name - The name of the version to be published.
 * @param {Object} context - The Lambda context object.
 * @returns {Promise<Object>} A promise that resolves to an object containing the response details.
 * @property {number} statusCode - The HTTP status code (200 for success, 400 for bad request, 500 for server error).
 * @property {Object} headers - The response headers, including CORS and content type settings.
 * @property {string} body - A JSON string containing the response message, version name, and publish date.
 *
 * @throws {Error} If there's an issue with input validation or emitting the publish event
 *
 * @example
 * // Successful invocation
 * const event = { queryStringParameters: { name: 'v1.0.0' } };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 200,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Publish process initiated for version v1.0.0","version":"v1.0.0","publishDate":"2023-06-01T12:00:00.000Z"}'
 * // }
 *
 * @example
 * // Failed invocation (missing name)
 * const event = { queryStringParameters: {} };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 400,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Error: \\"name\\" parameter is required in the query string"}'
 * // }
 */
export const publish = async (event, context) => {
  logger.info('[publish] start')
  const { defaultResponseHeaders } = getApplicationConfig()
  const name = event.queryStringParameters?.name

  logAnalyticsData({
    event,
    context
  })

  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the query string' })
    }
  }

  try {
    const publishDate = new Date().toISOString()

    // Emit event to trigger publisher handler which will perform the actual publish operation
    await emitPublishEvent({
      versionName: name,
      publishDate
    })

    logger.info(`[publish] Initiated publish process for version=${name}`)

    return {
      statusCode: 202,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Publish process initiated for version ${name}`,
        version: name,
        publishDate
      })
    }
  } catch (error) {
    logger.error('Error in publish process:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Error in publish process',
        error: error.message
      })
    }
  }
}

export default publish
