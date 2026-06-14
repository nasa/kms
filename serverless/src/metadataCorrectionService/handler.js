import { detectNativeMetadataFormat } from '@/shared/detectNativeMetadataFormat'
import { extractKeywordValidationFailures } from '@/shared/extractKeywordValidationFailures'
import { getCmrCollectionNativeMetadata } from '@/shared/getCmrCollectionNativeMetadata'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { invokeMetadataCorrectionDelegate } from '@/shared/invokeMetadataCorrectionDelegate'
import { logger } from '@/shared/logger'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import { resolveOldKeywordConceptUuid } from '@/shared/resolveOldKeywordConceptUuid'
import { validateCmrCollectionUmm } from '@/shared/validateCmrCollectionUmm'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

// Keep the service allowlist aligned with the delegates that are safe for the current flow.
const SUPPORTED_NATIVE_FORMATS = ['DIF10', 'ECHO10', 'UMM']

// Normalize request formats so the service can compare them consistently.
const normalizeNativeFormat = (nativeFormat) => String(nativeFormat).trim().toUpperCase()

// Accept only the collection identifier up front. Optional keyword-event context is used only
// to safely prove delete actions for resolved keywords.
const validateMetadataCorrectionRequest = (metadataCorrectionRequest) => {
  if (typeof metadataCorrectionRequest.collectionConceptId !== 'string'
    || metadataCorrectionRequest.collectionConceptId.trim().length === 0) {
    throw new Error('Incomplete metadata correction request: missing collectionConceptId')
  }
}

const normalizeKeywordEvent = (keywordEvent) => (
  keywordEvent && typeof keywordEvent === 'object'
    ? keywordEvent
    : {}
)

// Resolve one extracted invalid keyword into a concrete correction descriptor. Delete actions are
// only emitted when the optional triggering keyword event positively proves the deleted UUID.
const buildResolvedCorrection = async ({
  keywordFailure,
  keywordEvent
}) => {
  const resolvedKeywordReference = await resolveOldKeywordConceptUuid({
    scheme: keywordFailure.scheme,
    keywordValue: keywordFailure.keywordValue,
    keywordEvent
  })

  if (!resolvedKeywordReference) {
    return undefined
  }

  return {
    ...resolvedKeywordReference,
    scheme: keywordFailure.scheme,
    ummPath: keywordFailure.path
  }
}

// Run the collection validation -> extraction -> historical resolution pipeline. Without explicit
// delete context, unresolved historical/published cache gaps are skipped rather than inferred as deletes.
const resolveMetadataCorrectionsFromCollection = async ({
  collectionDetails,
  keywordEvent
}) => {
  const validationResult = await validateCmrCollectionUmm({
    providerId: collectionDetails.providerId,
    nativeId: collectionDetails.nativeId,
    umm: collectionDetails.umm
  })
  const keywordValidationFailures = extractKeywordValidationFailures({
    umm: collectionDetails.umm,
    validationErrors: validationResult.errors
  })
  const resolvedCorrections = (await Promise.all(
    keywordValidationFailures.map(async (keywordFailure) => buildResolvedCorrection({
      keywordFailure,
      keywordEvent
    }))
  )).filter(Boolean)

  return {
    keywordValidationFailures,
    resolvedCorrections
  }
}

/**
 * Metadata correction service that consumes collection-scoped correction requests from SQS.
 *
 * The service accepts a collection concept id, fetches the current collection details from CMR,
 * validates the UMM-C payload against published KMS keywords, resolves concrete corrections,
 * fetches the native metadata payload, and then invokes the selected native-format delegate.
 *
 * Optional `keywordEvent` context is used only to safely prove delete actions. Without that
 * context, the service will resolve replacement-style corrections only and skip anything that
 * cannot be positively mapped to a current published keyword.
 *
 * @param {{ Records?: Array<{ body?: string, messageId?: string }> }} event - SQS batch event.
 * @returns {Promise<{batchItemFailures: Array}>} Empty batch failures for acknowledged messages.
 */
export const metadataCorrectionService = async (event) => {
  const records = event?.Records || []

  await Promise.all(records.map(async (record) => {
    try {
      const metadataCorrectionRequest = JSON.parse(record.body || '{}')
      const keywordEvent = normalizeKeywordEvent(metadataCorrectionRequest.keywordEvent)

      logger.info('[metadata-correction] Received metadata correction request', {
        collectionConceptId: metadataCorrectionRequest.collectionConceptId,
        messageId: record.messageId,
        metadataCorrectionRequest
      })

      validateMetadataCorrectionRequest(metadataCorrectionRequest)

      const collectionDetails = await getCmrCollectionUmmDetails({
        collectionConceptId: metadataCorrectionRequest.collectionConceptId
      })
      const { collectionConceptId } = collectionDetails
      const nativeFormat = normalizeNativeFormat(detectNativeMetadataFormat({
        format: collectionDetails.format
      }))

      if (!SUPPORTED_NATIVE_FORMATS.includes(nativeFormat)) {
        throw new Error(`Unsupported native format: ${nativeFormat}`)
      }

      const {
        keywordValidationFailures,
        resolvedCorrections
      } = await resolveMetadataCorrectionsFromCollection({
        collectionDetails,
        keywordEvent
      })

      logger.info('[metadata-correction] Resolved metadata corrections from collection UMM', {
        collectionConceptId,
        messageId: record.messageId,
        nativeFormat,
        keywordValidationFailureCount: keywordValidationFailures.length,
        resolvedCorrectionCount: resolvedCorrections.length
      })

      if (resolvedCorrections.length === 0) {
        logger.info('[metadata-correction] No resolvable keyword corrections found', {
          collectionConceptId,
          messageId: record.messageId,
          nativeFormat,
          keywordValidationFailureCount: keywordValidationFailures.length
        })

        return
      }

      logger.info('[metadata-correction] Prepared resolved corrections for native metadata delegate', {
        collectionConceptId,
        messageId: record.messageId,
        nativeFormat,
        resolvedCorrections
      })

      const metadataPayload = await getCmrCollectionNativeMetadata({
        collectionConceptId,
        revisionId: collectionDetails.revisionId
      })

      const correctionResult = await invokeMetadataCorrectionDelegate({
        collectionConceptId,
        providerId: collectionDetails.providerId,
        nativeId: collectionDetails.nativeId,
        nativeFormat,
        metadataPayload,
        corrections: resolvedCorrections
      })
      const correctionsForAudit = Array.isArray(correctionResult.correctionsApplied)
        ? correctionResult.correctionsApplied
        : []

      if (correctionsForAudit.length > 0) {
        const auditResult = await persistMetadataCorrectionAuditLog({
          collectionConceptId,
          keywordEvent,
          nativeFormat,
          delegateName: correctionResult.delegateName || nativeFormat.toLowerCase(),
          corrections: correctionsForAudit,
          status: 'pending'
        })

        logger.info('[metadata-correction] Persisted metadata correction audit log', {
          collectionConceptId,
          messageId: record.messageId,
          nativeFormat,
          auditResult
        })
      }

      logger.info('[metadata-correction] Produced corrected metadata payload', {
        collectionConceptId,
        messageId: record.messageId,
        nativeFormat,
        correctionCount: correctionResult.correctionCount,
        correctionsApplied: correctionResult.correctionsApplied || [],
        correctedMetadata: correctionResult.correctedMetadata ?? ''
      })

      const writeResult = await writeCorrectedMetadataToCmr({
        collectionConceptId,
        providerId: collectionDetails.providerId,
        nativeId: collectionDetails.nativeId,
        nativeFormat,
        correctedMetadata: correctionResult.correctedMetadata ?? '',
        correctionCount: correctionResult.correctionCount || 0,
        correctionsApplied: correctionResult.correctionsApplied || [],
        source: metadataCorrectionRequest.source || 'metadataCorrectionService'
      })

      logger.info('[metadata-correction] Stubbed corrected metadata write to CMR', {
        collectionConceptId,
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
