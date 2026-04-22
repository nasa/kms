import { logger } from '@/shared/logger'

/**
 * Metadata correction service placeholder that consumes metadata correction requests from SQS.
 *
 * This proves the SNS/SQS/Lambda plumbing for KMS-676. KMS-675B will replace the stubbed
 * logging behavior with real metadata fetch, keyword resolution, and native metadata updates.
 *
 * TODO: Create a follow-up ticket for targeted correction requests. When a request includes
 * the affected keyword event, fetch the collection's native metadata from CMR, detect the
 * metadata format, and delegate the specific keyword replacement to the appropriate updater
 * for ISO, ECHO10, DIF10, or UMM. Each updater should modify only the affected keyword fields
 * for its metadata format.
 *
 * TODO: Create a follow-up ticket for untargeted correction requests. If the request does not
 * include a targeted keyword event, fetch the collection's UMM metadata and identify invalid
 * keyword paths by validating against current KMS, or by asking CMR to validate and return the
 * invalid keyword report. Use historical KMS lookup to map stale keyword paths to current KMS
 * values, then call the native metadata updater with historical -> current keyword
 * replacements.
 *
 * TODO: Consider making the correction service collection-level by default. Even when a
 * keyword event is present, treat it as context and validate all keywords in the collection so
 * the service can fix every stale keyword in one metadata update instead of issuing multiple
 * targeted updates for the same collection.
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
