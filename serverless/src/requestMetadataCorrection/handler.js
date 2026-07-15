import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'

/**
 * Parses the API Gateway JSON request body.
 *
 * @param {string|undefined} body Raw API Gateway request body.
 * @returns {Object} Parsed request payload.
 * @throws {Error} When the body is missing, not valid JSON, or not a JSON object.
 */
const parseRequestBody = (body) => {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw new Error('Invalid metadata correction request: missing request body')
  }

  let parsedBody

  try {
    parsedBody = JSON.parse(body)
  } catch {
    throw new Error('Invalid metadata correction request: body must be valid JSON')
  }

  if (parsedBody === null || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    throw new Error('Invalid metadata correction request: body must be a JSON object')
  }

  return parsedBody
}

/**
 * Validates and deduplicates collection concept ids while preserving request order.
 *
 * @param {unknown} collectionConceptIds Raw request field value.
 * @returns {{ requestedCount: number, acceptedCollectionConceptIds: string[] }} Normalized request details.
 * @throws {Error} When the request does not contain one or more valid concept ids.
 */
const normalizeCollectionConceptIds = (collectionConceptIds) => {
  if (!Array.isArray(collectionConceptIds)) {
    throw new Error('Invalid metadata correction request: collectionConceptIds must be an array')
  }

  if (collectionConceptIds.length === 0) {
    throw new Error('Invalid metadata correction request: collectionConceptIds must contain at least one value')
  }

  const acceptedCollectionConceptIds = []
  const seen = new Set()

  collectionConceptIds.forEach((value, index) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `Invalid metadata correction request: collectionConceptIds[${index}] must be a non-empty string`
      )
    }

    const normalizedValue = value.trim()

    if (!seen.has(normalizedValue)) {
      seen.add(normalizedValue)
      acceptedCollectionConceptIds.push(normalizedValue)
    }
  })

  return {
    requestedCount: collectionConceptIds.length,
    acceptedCollectionConceptIds
  }
}

/**
 * Maps handler validation failures to a client error and publish/runtime failures to server errors.
 *
 * @param {Error} error Thrown handler error.
 * @returns {number} HTTP status code.
 */
const getErrorStatusCode = (error) => {
  const message = String(error?.message || '')

  if (message.startsWith('Invalid metadata correction request:')) {
    return 400
  }

  return 500
}

/**
 * Converts a rejected publish reason into a stable response/log string.
 *
 * @param {unknown} error Rejection reason.
 * @returns {string} Serialized error message.
 */
const toErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.toString()
  }

  return String(error)
}

/**
 * Queues metadata correction requests for one or more collection concept ids.
 *
 * This endpoint is intentionally fire-and-forget. It validates the request body, deduplicates
 * concept ids within that request, and publishes one FIFO message per collection so the existing
 * async correction worker can process them through the same queue contract.
 *
 * @param {object} event API Gateway event.
 * @param {string} [event.body] Raw JSON request body.
 * @param {object} context Lambda context.
 * @returns {Promise<object>} API Gateway response object.
 */
export const requestMetadataCorrection = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  try {
    const requestBody = parseRequestBody(event?.body)
    const {
      requestedCount,
      acceptedCollectionConceptIds
    } = normalizeCollectionConceptIds(requestBody.collectionConceptIds)
    const requestedAt = new Date().toISOString()

    logger.info('[metadata-correction] Received asynchronous metadata correction request', {
      requestedCount,
      acceptedCount: acceptedCollectionConceptIds.length,
      collectionConceptIds: acceptedCollectionConceptIds
    })

    const publishResults = await Promise.allSettled(
      acceptedCollectionConceptIds.map(async (collectionConceptId) => {
        const publishResult = await publishMetadataCorrectionRequest({
          source: 'metadataCorrectionApi',
          collectionConceptId,
          requestedAt
        })

        return {
          collectionConceptId,
          messageId: publishResult.messageId,
          messageGroupId: publishResult.messageGroupId
        }
      })
    )

    const accepted = []
    const failed = []

    publishResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        accepted.push(result.value)

        return
      }

      failed.push({
        collectionConceptId: acceptedCollectionConceptIds[index],
        error: toErrorMessage(result.reason)
      })
    })

    if (failed.length > 0 && accepted.length === 0) {
      const firstRejectedResultIndex = publishResults.findIndex(({ status }) => status === 'rejected')

      throw publishResults[firstRejectedResultIndex].reason
    }

    if (failed.length > 0) {
      logger.error('[metadata-correction] Partially failed asynchronous metadata correction request', {
        requestedCount,
        acceptedCount: accepted.length,
        failedCount: failed.length,
        accepted,
        failed
      })
    }

    return {
      statusCode: 202,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestedCount,
        acceptedCount: accepted.length,
        failedCount: failed.length,
        accepted,
        failed
      }, null, 2)
    }
  } catch (error) {
    logger.error('[metadata-correction] Failed asynchronous metadata correction request', error)

    return {
      statusCode: getErrorStatusCode(error),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default requestMetadataCorrection
