import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'

const KEYWORD_EVENT_SCHEMA_URL = 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0'
const KEYWORD_EVENT_SCHEMA_NAME = 'Kms-Keyword-Event'
const KEYWORD_EVENT_SCHEMA_VERSION = '1.0'
const VALID_EVENT_TYPES = ['INSERTED', 'UPDATED', 'DELETED']

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
    'EventType',
    'Scheme',
    'UUID',
    'NewKeywordPath'
  ]

  const missingField = requiredFields.find(
    (field) => !payload[field] || typeof payload[field] !== 'string'
  )

  if (missingField) {
    throw new Error(`Missing or invalid field: ${missingField}`)
  }

  if (!VALID_EVENT_TYPES.includes(payload.EventType)) {
    throw new Error(`Invalid field: EventType must be one of ${VALID_EVENT_TYPES.join(', ')}`)
  }

  if (
    payload.OldKeywordPath !== undefined
    && payload.OldKeywordPath !== null
    && typeof payload.OldKeywordPath !== 'string'
  ) {
    throw new Error('Invalid field: OldKeywordPath')
  }

  if (payload.Timestamp === undefined || payload.Timestamp === null) {
    throw new Error('Missing or invalid field: Timestamp')
  }

  if (!isValidIsoTimestamp(payload.Timestamp)) {
    throw new Error('Invalid field: Timestamp must be ISO-8601')
  }

  if (
    payload.MetadataSpecification !== undefined
    && (
      typeof payload.MetadataSpecification !== 'object'
      || payload.MetadataSpecification === null
      || Array.isArray(payload.MetadataSpecification)
    )
  ) {
    throw new Error('Invalid field: MetadataSpecification')
  }
}

/**
 * Normalizes the event payload KMS publishes so it always carries the current metadata schema URL.
 *
 * @param {Record<string, unknown>} payload - Validated keyword event payload from the request.
 * @returns {Record<string, unknown>} Keyword event payload enriched with metadata specification values.
 */
const buildKeywordEventPayload = (payload) => ({
  ...payload,
  MetadataSpecification: {
    Name: payload.MetadataSpecification?.Name || KEYWORD_EVENT_SCHEMA_NAME,
    URL: KEYWORD_EVENT_SCHEMA_URL,
    Version: payload.MetadataSpecification?.Version || KEYWORD_EVENT_SCHEMA_VERSION
  }
})

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
    defaultResponseHeaders
  } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  try {
    const payload = JSON.parse(event?.body || '{}')
    validateKeywordEvent(payload)
    const keywordEventPayload = buildKeywordEventPayload(payload)

    const result = await publishKeywordEvent(keywordEventPayload)

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Keyword event published successfully',
        topicArn: result.topicArn,
        messageId: result.messageId,
        event: keywordEventPayload
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
