import { logger } from '@/shared/logger'
import { runCollectionMetadataCorrection } from '@/shared/runCollectionMetadataCorrection'

/**
 * Metadata correction service that consumes collection-scoped correction requests from SQS.
 *
 * The worker remains asynchronous for keyword-event-driven correction requests, but the actual
 * "fix one collection" business logic now lives in `runCollectionMetadataCorrection` so the same
 * flow can also be reused by synchronous API endpoints.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  await Promise.all(records.map(async (record) => {
    try {
      const metadataCorrectionRequest = JSON.parse(record.body || '{}')

      logger.info('[metadata-correction] Received metadata correction request', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        metadataCorrectionRequest
      })

      await runCollectionMetadataCorrection({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        keywordEvent: metadataCorrectionRequest.keywordEvent,
        messageId: record.messageId,
        source: metadataCorrectionRequest.source
      })
    } catch (error) {
      logger.error('[metadata-correction] Failed to process metadata correction request', error)
      throw error
    }
  }))

  return {
    batchItemFailures: []
  }
}

export default metadataCorrectionService
