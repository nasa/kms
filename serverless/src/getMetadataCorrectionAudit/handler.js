import { getApplicationConfig } from '@/shared/getConfig'
import { getMetadataCorrectionAuditLog } from '@/shared/getMetadataCorrectionAuditLog'
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
    limit
  } = event?.queryStringParameters || {}

  try {
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
