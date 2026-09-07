import { getApplicationConfig } from '@/shared/getConfig'
import {
  getMetadataCorrectionAuditByRunId,
  getMetadataCorrectionAuditLog
} from '@/shared/getMetadataCorrectionAuditLog'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'

/**
 * Read-side audit endpoint for metadata-correction activity.
 *
 * The metadata-correction service stores one DocumentDB document per collection-correction run.
 * This handler exposes those runs for MMT audit search, reporting, and troubleshooting.
 *
 * In practice this is useful for:
 * - local smoke-test verification
 * - troubleshooting correction behavior in deployed environments
 * - lightweight audit/history lookup by collection, keyword uuid, action, scheme, or status
 */

/**
 * Retrieves metadata-correction audit runs from DocumentDB.
 *
 * Supported query parameters:
 * - collectionConceptId
 * - keywordConceptUuid
 * - action
 * - scheme
 * - status
 * - nativeFormat
 * - publishedVersionName
 * - source
 * - startDate / endDate
 * - paginationToken
 * - limit
 *
 * A `runId` path parameter returns one detailed audit document. Add `includeDiff=true` to that
 * request to include its native-metadata patch.
 *
 * @param {object} event - API Gateway event.
 * @param {object} context - Lambda context.
 * @returns {Promise<object>} API Gateway response object.
 *
 * @example
 * await getMetadataCorrectionAudit({
 *   queryStringParameters: { status: 'applied', limit: '25' }
 * }, context)
 * // { statusCode: 200, body: '{"items":[...],"nextPaginationToken":null}' }
 */
export const getMetadataCorrectionAudit = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const {
    collectionConceptId,
    keywordConceptUuid,
    action,
    scheme,
    status,
    nativeFormat,
    publishedVersionName,
    source,
    startDate,
    endDate,
    paginationToken,
    includeDiff,
    limit
  } = event?.queryStringParameters || {}
  const runId = event?.pathParameters?.runId

  try {
    if (runId) {
      const auditDocument = await getMetadataCorrectionAuditByRunId({
        runId,
        includeDiff
      })

      return {
        statusCode: auditDocument ? 200 : 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          auditDocument || { error: `Metadata correction audit run not found: ${runId}` },
          null,
          2
        )
      }
    }

    const auditPage = await getMetadataCorrectionAuditLog({
      collectionConceptId,
      keywordConceptUuid,
      action,
      scheme,
      status,
      nativeFormat,
      publishedVersionName,
      source,
      startDate,
      endDate,
      paginationToken,
      limit
    })

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(auditPage, null, 2)
    }
  } catch (error) {
    logger.error(`Error retrieving metadata correction audit log, error=${error.toString()}`)

    const isClientError = String(error?.message || '')
      .startsWith('Invalid metadata correction audit')

    return {
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      statusCode: isClientError ? 400 : 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getMetadataCorrectionAudit
