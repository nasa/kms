import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

const PUBLISH_EVENT_SOURCE = 'kms.publish'
const PUBLISH_EVENT_DETAIL_TYPE = 'kms.published.version.changed'

const publishEventClient = new EventBridgeClient({})

/**
 * Emits a publish-version-changed event to EventBridge so cache-prime can run asynchronously.
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
 * This function handles the process of publishing a new version of the keyword set by
 * performing a SPARQL update operation. It performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided in the query string.
 * 2. Generates a SPARQL update query to perform the following operations:
 *    - Copy the 'draft' version to become the new 'published' version.
 *    - Update metadata for the new 'published' version with the provided name and timestamp.
 * 3. Executes the SPARQL update request.
 * 4. Returns with a 200 (OK) status upon successful completion, or appropriate error status.
 *
 * Note: This function maintains only two versions: 'draft' and 'published'. The previous
 * 'published' version is overwritten by this operation.
 *
 * @async
 * @function publish
 * @param {Object} event - The event object passed from API Gateway.
 * @param {Object} event.queryStringParameters - The query string parameters from the API request.
 * @param {string} event.queryStringParameters.name - The name of the version to be published.
 * @returns {Promise<Object>} A promise that resolves to an object containing the response details.
 * @property {number} statusCode - The HTTP status code (200 for success, 400 for bad request, 500 for server error).
 * @property {Object} headers - The response headers, including CORS and content type settings.
 * @property {string} body - A JSON string containing the response message, version name, and publish date.
 *
 * @throws {Error} If there's an issue with input validation or executing the publish process.
 *
 * @example
 * // Successful invocation
 * const event = { queryStringParameters: { name: 'v1.0.0' } };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 200,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Publish process completed for version v1.0.0","version":"v1.0.0","publishDate":"2023-06-01T12:00:00.000Z"}'
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
    const updateDate = new Date().toISOString()
    const publishQuery = getPublishUpdateQuery(name, updateDate)

    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      body: publishQuery
    })

    if (!response.ok) {
      throw new Error(`Failed to execute publish update: ${response.status} ${response.statusText}`)
    }

    try {
      await emitPublishEvent({
        versionName: name,
        publishDate: updateDate
      })

      logger.info(`[publish] emitted cache-prime event for version=${name}`)
    } catch (eventError) {
      // Publish operation succeeded; do not fail publish if event emit fails.
      logger.error(`[publish] failed to emit cache-prime event error=${eventError}`)
    }

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Publish process completed for version ${name}`,
        version: name,
        publishDate: updateDate
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
