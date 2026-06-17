import { getApplicationConfig } from '@/shared/getConfig'
import { getMetadataCorrectionAuditLog } from '@/shared/getMetadataCorrectionAuditLog'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'

/**
 * Read-side audit endpoint for metadata-correction activity.
 *
 * The metadata-correction service writes one audit record per resolved correction into RDF4J.
 * This handler exposes those records through an API so we can inspect what corrections were
 * attempted, which collection they applied to, what keyword uuid/path was involved, and whether
 * the result is still pending or has been applied.
 *
 * In practice this is useful for:
 * - local smoke-test verification
 * - troubleshooting correction behavior in deployed environments
 * - lightweight audit/history lookup by collection, keyword uuid, action, scheme, or status
 */

/**
 * Retrieves metadata-correction audit rows from RDF4J.
 *
 * Supported query parameters:
 * - collectionConceptId
 * - keywordConceptUuid
 * - action
 * - scheme
 * - status
 * - latestOnly
 * - limit
 *
 * @param {object} event - API Gateway event.
 * @param {object} context - Lambda context.
 * @returns {Promise<object>} API Gateway response object.
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
    latestOnly,
    limit
  } = event?.queryStringParameters || {}

  try {
    const items = await getMetadataCorrectionAuditLog({
      collectionConceptId,
      keywordConceptUuid,
      action,
      scheme,
      status,
      latestOnly,
      limit
    })

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items
      }, null, 2)
    }
  } catch (error) {
    logger.error(`Error retrieving metadata correction audit log, error=${error.toString()}`)

    return {
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getMetadataCorrectionAudit
