import {
  getProviderIdFromCollectionConceptId,
  isWritebackEnabledForProvider
} from '@/shared/cmrWritebackProviders'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { runCollectionMetadataCorrection } from '@/shared/runCollectionMetadataCorrection'

/**
 * Decodes an API Gateway path segment into the concept id string we use internally.
 *
 * @param {string|undefined} value Raw path segment from API Gateway.
 * @returns {string|undefined} Decoded concept id, or `undefined` when absent.
 */
const decodePathSegment = (value) => (
  typeof value === 'string'
    ? decodeURIComponent(value.replace(/\+/g, ' '))
    : undefined
)

/**
 * Maps known request-shape failures to a client error and everything else to a server error.
 *
 * @param {Error} error Thrown handler error.
 * @returns {number} API status code.
 */
const getErrorStatusCode = (error) => {
  const message = String(error?.message || '')

  if (message.startsWith('Incomplete metadata correction request:')
    || message.startsWith('Unsupported native format:')) {
    return 400
  }

  return 500
}

/**
 * Synchronously runs metadata correction for exactly one collection concept id.
 *
 * This endpoint is intentionally operator-oriented. It exposes the same correction pipeline used
 * by the asynchronous worker, but returns a rich JSON summary immediately so maintainers can see:
 * - how many keyword validation failures were found
 * - which failures were resolved into concrete corrections
 * - what the delegate applied
 * - what was written to audit / CMR
 *
 * CMR itself also calls this endpoint (via `Cmr-Send-Kms-Metadata-Fixer`), so a collection whose
 * provider isn't in `CMR_WRITEBACK_PROVIDERS` is skipped before the published version is even
 * looked up, instead of running the full correction workflow only to discard the writeback.
 *
 * @param {object} event API Gateway event.
 * @param {object} [event.pathParameters] API Gateway path parameters.
 * @param {string} [event.pathParameters.collectionConceptId] Collection concept id to run.
 * @param {object} context Lambda context.
 * @returns {Promise<object>} API Gateway response object.
 */
export const runMetadataCorrection = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()

  logAnalyticsData({
    event,
    context
  })

  const collectionConceptId = decodePathSegment(event?.pathParameters?.collectionConceptId)

  try {
    logger.info('[metadata-correction] Received synchronous metadata correction request', {
      collectionConceptId
    })

    if (collectionConceptId) {
      const providerId = getProviderIdFromCollectionConceptId(collectionConceptId)

      if (!isWritebackEnabledForProvider(providerId)) {
        logger.debug(
          '[metadata-correction] Skipping synchronous metadata correction request for provider not enabled '
          + `collectionConceptId=${collectionConceptId} providerId=${providerId || 'n/a'}`
        )

        return {
          statusCode: 200,
          headers: {
            ...defaultResponseHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            outcome: 'provider-not-enabled',
            collectionConceptId,
            providerId,
            source: 'metadataCorrectionApi'
          }, null, 2)
        }
      }
    }

    const { versionName: publishedVersionName } = await getVersionMetadata('published')

    const result = await runCollectionMetadataCorrection({
      collectionConceptId,
      publishedVersionName,
      source: 'metadataCorrectionApi'
    })

    return {
      statusCode: 200,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result, null, 2)
    }
  } catch (error) {
    logger.error('[metadata-correction] Failed synchronous metadata correction request', error)

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

export default runMetadataCorrection
