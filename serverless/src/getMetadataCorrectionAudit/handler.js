import { getApplicationConfig } from '@/shared/getConfig'
import { getMetadataCorrectionAuditLog } from '@/shared/getMetadataCorrectionAuditLog'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'

/**
 * Retrieves metadata-correction audit rows from RDF4J.
 *
 * Supported query parameters:
 * - collectionConceptId
 * - keywordConceptUuid
 * - action
 * - scheme
 * - status
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
    limit
  } = event?.queryStringParameters || {}

  try {
    const items = await getMetadataCorrectionAuditLog({
      collectionConceptId,
      keywordConceptUuid,
      action,
      scheme,
      status,
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
