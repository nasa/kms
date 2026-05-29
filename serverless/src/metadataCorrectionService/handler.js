import { applyDif10MetadataCorrections } from '@/shared/applyDif10MetadataCorrections'
import { logger } from '@/shared/logger'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

const SUPPORTED_NATIVE_FORMATS = ['DIF10']

// Normalize request formats so the service can compare them consistently.
const normalizeNativeFormat = (nativeFormat) => String(nativeFormat).trim().toUpperCase()

// This service only accepts fully prepared correction requests. Earlier pipeline stages are
// responsible for fetching native metadata and building the concrete corrections array.
const validateMetadataCorrectionRequest = (metadataCorrectionRequest) => {
  const missingFields = []

  if (typeof metadataCorrectionRequest.collectionConceptId !== 'string'
    || metadataCorrectionRequest.collectionConceptId.trim().length === 0) {
    missingFields.push('collectionConceptId')
  }

  if (typeof metadataCorrectionRequest.nativeFormat !== 'string'
    || metadataCorrectionRequest.nativeFormat.trim().length === 0) {
    missingFields.push('nativeFormat')
  }

  if (typeof metadataCorrectionRequest.metadataPayload !== 'string'
    || metadataCorrectionRequest.metadataPayload.length === 0) {
    missingFields.push('metadataPayload')
  }

  if (!Array.isArray(metadataCorrectionRequest.corrections)) {
    missingFields.push('corrections')
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Incomplete metadata correction request: missing ${missingFields.join(', ')}`
    )
  }

  const nativeFormat = normalizeNativeFormat(metadataCorrectionRequest.nativeFormat)

  if (!SUPPORTED_NATIVE_FORMATS.includes(nativeFormat)) {
    throw new Error(`Unsupported native format: ${nativeFormat}`)
  }

  return nativeFormat
}

/**
 * Metadata correction service that consumes metadata correction requests from SQS.
 *
 * This service expects a fully prepared correction request and ends at a clean handoff boundary:
 * 1. parse the request
 * 2. validate that the request is complete and supported
 * 3. apply the supported DIF10 metadata corrections
 * 4. pass the corrected payload to the downstream CMR write stub
 *
 * A follow-on external ticket will replace the write stub with the component that writes
 * corrected metadata back to CMR.
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

      const nativeFormat = validateMetadataCorrectionRequest(metadataCorrectionRequest)

      const correctionResult = await applyDif10MetadataCorrections({
        ...metadataCorrectionRequest,
        nativeFormat
      })

      logger.info('[metadata-correction] Produced corrected metadata payload', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        nativeFormat,
        correctionCount: correctionResult.correctionCount,
        correctionsApplied: correctionResult.correctionsApplied || [],
        correctedMetadata: correctionResult.correctedMetadata || ''
      })

      const writeResult = await writeCorrectedMetadataToCmr({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        nativeFormat,
        correctedMetadata: correctionResult.correctedMetadata || '',
        correctionCount: correctionResult.correctionCount || 0,
        correctionsApplied: correctionResult.correctionsApplied || [],
        source: metadataCorrectionRequest.source || 'metadataCorrectionService'
      })

      logger.info('[metadata-correction] Stubbed corrected metadata write to CMR', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        nativeFormat,
        correctionCount: correctionResult.correctionCount,
        writeResult
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
