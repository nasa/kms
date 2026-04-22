import { logger } from '@/shared/logger'

/**
 * Metadata correction service placeholder that consumes metadata correction requests from SQS.
 *
 * This proves the SNS/SQS/Lambda plumbing for KMS-676. KMS-675B will replace the stubbed
 * logging behavior with real metadata fetch, keyword resolution, and native metadata updates.
 *
 * TODO: Create a follow-up ticket for targeted correction requests. When the request includes
 * the affected keyword event, fetch the collection's native metadata from CMR, detect its
 * format, and delegate the specific keyword update to a format-specific updater such as ISO,
 * ECHO10, DIF10, or UMM. Each delegate should know how to update only the affected keyword
 * fields for its metadata format.
 *
 * TODO: Create a follow-up ticket for untargeted correction requests. If the request does not
 * include a targeted keyword event, fetch the collection's UMM metadata, inspect all keyword
 * paths, validate them against current KMS, use historical KMS lookup to map stale keywords to
 * current keyword paths, and then call the native metadata updater with historical -> current
 * keyword replacements.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  records.forEach((record) => {
    try {
      const metadataCorrectionRequest = JSON.parse(record.body || '{}')

      logger.info('[metadata-correction] Received metadata correction request', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        metadataCorrectionRequest
      })
    } catch (error) {
      logger.error('[metadata-correction] Failed to parse metadata correction request', error)
      throw error
    }
  })

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
