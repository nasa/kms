import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'

/**
 * Verifies that a timestamp is a strict ISO-8601 string that round-trips through `Date`.
 *
 * @param {unknown} value - Candidate timestamp value from the request payload.
 * @returns {boolean} `true` when the value is a valid ISO-8601 timestamp string.
 */
const isValidIsoTimestamp = (value) => {
  if (!value || typeof value !== 'string') {
    return false
  }

  const parsed = new Date(value)

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

/**
 * Validates the keyword event contract expected by the test publish endpoint.
 *
 * @param {unknown} payload - Parsed request body.
 * @throws {Error} When the payload is not a JSON object or required fields are invalid.
 * @returns {void}
 */
const validateKeywordEvent = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Request body must be a JSON object')
  }

  const requiredFields = [
    'event_type',
    'scheme',
    'uuid',
    'new_keyword_path'
  ]

  requiredFields.forEach((field) => {
    if (!payload[field] || typeof payload[field] !== 'string') {
      throw new Error(`Missing or invalid field: ${field}`)
    }
  })

  if (
    payload.old_keyword_path !== undefined
    && payload.old_keyword_path !== null
    && typeof payload.old_keyword_path !== 'string'
  ) {
    throw new Error('Invalid field: old_keyword_path')
  }

  if (payload.timestamp === undefined || payload.timestamp === null) {
    throw new Error('Missing or invalid field: timestamp')
  }

  if (!isValidIsoTimestamp(payload.timestamp)) {
    throw new Error('Invalid field: timestamp must be ISO-8601')
  }
}

/**
 * Publishes a caller-supplied keyword event to the configured SNS topic.
 *
 * This endpoint is used to exercise the outbound event path end-to-end by validating
 * the request body, publishing the event, and returning the SNS publish metadata.
 *
 * @param {{ body?: string } | undefined} event - API Gateway proxy event.
 * @param {import('aws-lambda').Context} context - Lambda invocation context for analytics logging.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 * API Gateway-compatible success or validation error response.
 */
export const keywordEventsTestPublish = async (event, context) => {
  const {
    defaultResponseHeaders,
    keywordEventsTopicArn
  } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  try {
    const payload = JSON.parse(event?.body || '{}')
    validateKeywordEvent(payload)

    const result = await publishKeywordEvent(payload)

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Keyword event published successfully',
        topicArn: keywordEventsTopicArn || result.topicArn,
        messageId: result.messageId,
        event: payload
      })
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Failed to publish keyword event',
        error: error.message
      })
    }
  }
}

export default keywordEventsTestPublish
