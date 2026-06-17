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

/**
 * True when the metadata-correction flow is running in the repo's local LocalStack mode.
 *
 * @returns {boolean} `true` when local-only native-format support may be enabled.
 */
const isLocalMetadataCorrectionMode = () => (
  String(process.env.USE_LOCALSTACK || '').toLowerCase() === 'true'
  || String(process.env.useLocalstack || '').toLowerCase() === 'true'
)

/**
 * True when the current native format is supported by the active runtime mode.
 *
 * DIF10 is supported everywhere. UMM is supported only for local smoke/development mode.
 * DIF9 is detected separately so it does not silently flow through the DIF10 delegate, but it
 * remains unsupported until it has its own correction delegate.
 *
 * @param {string} nativeFormat Normalized native format label.
 * @returns {boolean} `true` when the runner should process this format.
 */
const isSupportedNativeFormat = (nativeFormat) => (
  nativeFormat === 'DIF10'
  || (nativeFormat === 'UMM' && isLocalMetadataCorrectionMode())
)

/**
 * Normalizes native-format labels so comparisons stay case-insensitive.
 *
 * @param {string} nativeFormat Native format label from CMR metadata.
 * @returns {string} Upper-cased native format string.
 */
const normalizeNativeFormat = (nativeFormat) => String(nativeFormat).trim().toUpperCase()

/**
 * Validates the minimum correction-request contract required by the correction runner.
 *
 * @param {{ collectionConceptId?: string }} metadataCorrectionRequest Parsed request inputs.
 * @returns {void}
 * @throws {Error} If the request does not include a collection concept id.
 */
const validateMetadataCorrectionRequest = (metadataCorrectionRequest) => {
  if (typeof metadataCorrectionRequest.collectionConceptId !== 'string'
    || metadataCorrectionRequest.collectionConceptId.trim().length === 0) {
    throw new Error('Incomplete metadata correction request: missing collectionConceptId')
  }
}

/**
 * Normalizes optional keyword-event context into a plain object for downstream resolution.
 *
 * @param {unknown} keywordEvent Optional triggering keyword event payload.
 * @returns {Object} Normalized keyword event object.
 */
const normalizeKeywordEvent = (keywordEvent) => (
  keywordEvent && typeof keywordEvent === 'object'
    ? keywordEvent
    : {}
)

/**
 * Normalizes the audit trigger metadata used when persisting correction audit rows.
 *
 * The synchronous concept-id endpoint does not originate from a keyword event, so we stamp those
 * audit rows with a synthetic `MANUAL` action to distinguish them from event-driven runs.
 *
 * @param {Object} params Normalization inputs.
 * @param {Object} params.keywordEvent Optional triggering keyword event context.
 * @param {string} params.source Source label for the current correction request.
 * @returns {Object} Audit-ready keyword event object.
 */
const buildAuditKeywordEvent = ({
  keywordEvent,
  source
}) => {
  if (!keywordEvent?.eventType && source === 'metadataCorrectionApi') {
    return {
      ...keywordEvent,
      eventType: 'MANUAL'
    }
  }

  return keywordEvent
}

/**
 * Resolves one extracted invalid keyword into a concrete correction descriptor.
 *
 * Delete actions are only emitted when the optional triggering keyword event positively proves
 * the deleted UUID.
 *
 * @param {Object} params Resolution inputs.
 * @param {Object} params.keywordFailure Extracted invalid-keyword failure details.
 * @param {Object} params.keywordEvent Optional triggering keyword event context.
 * @returns {Promise<Object|undefined>} Resolved correction descriptor, if the keyword can be mapped.
 */
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

/**
 * Runs the validate -> extract -> historical resolution pipeline for one collection.
 *
 * Without explicit delete context, unresolved historical/published cache gaps are skipped rather
 * than inferred as deletes.
 *
 * @param {Object} params Resolution inputs.
 * @param {Object} params.collectionDetails Collection UMM details fetched from CMR.
 * @param {Object} params.keywordEvent Optional triggering keyword event context.
 * @returns {Promise<{keywordValidationFailures: Array, resolvedCorrections: Array}>}
 * Validation failures plus the subset that could be resolved into corrections.
 */
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
 * Chooses the no-op outcome label when the collection produced no runnable corrections.
 *
 * @param {Array} keywordValidationFailures Extracted keyword failures from UMM validation.
 * @returns {'no-keyword-issues'|'no-resolved-corrections'} Result label for the response payload.
 */
const determineNoOpOutcome = (keywordValidationFailures) => (
  keywordValidationFailures.length === 0
    ? 'no-keyword-issues'
    : 'no-resolved-corrections'
)

/**
 * Runs the full metadata-correction flow for one collection and returns a rich summary.
 *
 * This is the shared execution seam used by both the asynchronous SQS consumer and the
 * synchronous API endpoint. It intentionally exposes the extracted validation failures,
 * resolved corrections, audit persistence results, and writeback outcome so operators can
 * inspect exactly what happened for a single collection run.
 *
 * @param {Object} params Correction request parameters.
 * @param {string} params.collectionConceptId Collection concept id to correct.
 * @param {Object} [params.keywordEvent] Optional triggering keyword event context.
 * @param {string} [params.messageId] Optional request/message identifier for logging.
 * @param {string} [params.source='metadataCorrectionService'] Source label for audit/writeback telemetry.
 * @returns {Promise<Object>} Rich per-collection correction result.
 */
export const runCollectionMetadataCorrection = async ({
  collectionConceptId,
  keywordEvent: rawKeywordEvent,
  messageId,
  source = 'metadataCorrectionService'
} = {}) => {
  validateMetadataCorrectionRequest({
    collectionConceptId
  })

  const keywordEvent = normalizeKeywordEvent(rawKeywordEvent)
  const auditKeywordEvent = buildAuditKeywordEvent({
    keywordEvent,
    source
  })
  const collectionDetails = await getCmrCollectionUmmDetails({
    collectionConceptId
  })
  const nativeFormat = normalizeNativeFormat(detectNativeMetadataFormat({
    format: collectionDetails.format
  }))

  if (!isSupportedNativeFormat(nativeFormat)) {
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
    collectionConceptId: collectionDetails.collectionConceptId,
    messageId,
    nativeFormat,
    keywordValidationFailureCount: keywordValidationFailures.length,
    resolvedCorrectionCount: resolvedCorrections.length
  })

  if (resolvedCorrections.length === 0) {
    logger.info('[metadata-correction] No resolvable keyword corrections found', {
      collectionConceptId: collectionDetails.collectionConceptId,
      messageId,
      nativeFormat,
      keywordValidationFailureCount: keywordValidationFailures.length
    })

    return {
      outcome: determineNoOpOutcome(keywordValidationFailures),
      collectionConceptId: collectionDetails.collectionConceptId,
      providerId: collectionDetails.providerId,
      nativeId: collectionDetails.nativeId,
      revisionId: collectionDetails.revisionId,
      nativeFormat,
      keywordValidationFailureCount: keywordValidationFailures.length,
      keywordValidationFailures,
      resolvedCorrectionCount: 0,
      resolvedCorrections: [],
      correctionResult: null,
      auditResults: {
        pending: null,
        applied: null
      },
      writeResult: null,
      source
    }
  }

  logger.info('[metadata-correction] Prepared resolved corrections for native metadata delegate', {
    collectionConceptId: collectionDetails.collectionConceptId,
    messageId,
    nativeFormat,
    resolvedCorrections
  })

  const nativeMetadataResponse = await getCmrCollectionNativeMetadata({
    collectionConceptId: collectionDetails.collectionConceptId,
    revisionId: collectionDetails.revisionId,
    includeResponseMetadata: nativeFormat === 'UMM'
  })
  const metadataPayload = nativeFormat === 'UMM'
    ? nativeMetadataResponse.metadataPayload
    : nativeMetadataResponse
  const nativeMetadataContentType = nativeFormat === 'UMM'
    ? nativeMetadataResponse.contentType
    : String(collectionDetails.format || '')

  const rawCorrectionResult = await invokeMetadataCorrectionDelegate({
    collectionConceptId: collectionDetails.collectionConceptId,
    providerId: collectionDetails.providerId,
    nativeId: collectionDetails.nativeId,
    nativeFormat,
    metadataPayload,
    corrections: resolvedCorrections
  })
  const delegateName = rawCorrectionResult.delegateName || nativeFormat.toLowerCase()
  const correctionsApplied = Array.isArray(rawCorrectionResult.correctionsApplied)
    ? rawCorrectionResult.correctionsApplied
    : []
  const normalizedCorrectionCount = Number(rawCorrectionResult.correctionCount || 0)
  const correctedMetadata = rawCorrectionResult.correctedMetadata ?? ''
  let pendingAuditResult = null
  let appliedAuditResult = null

  if (correctionsApplied.length > 0) {
    pendingAuditResult = await persistMetadataCorrectionAuditLog({
      collectionConceptId: collectionDetails.collectionConceptId,
      keywordEvent: auditKeywordEvent,
      nativeFormat,
      delegateName,
      corrections: correctionsApplied,
      status: 'pending'
    })

    logger.info('[metadata-correction] Persisted metadata correction audit log', {
      collectionConceptId: collectionDetails.collectionConceptId,
      messageId,
      nativeFormat,
      auditResult: pendingAuditResult
    })
  }

  logger.info('[metadata-correction] Produced corrected metadata payload', {
    collectionConceptId: collectionDetails.collectionConceptId,
    messageId,
    nativeFormat,
    correctionCount: normalizedCorrectionCount,
    correctionsApplied,
    correctedMetadata
  })

  const writeResult = await writeCorrectedMetadataToCmr({
    collectionConceptId: collectionDetails.collectionConceptId,
    providerId: collectionDetails.providerId,
    nativeId: collectionDetails.nativeId,
    nativeFormat,
    nativeMetadataContentType,
    correctedMetadata,
    correctionCount: normalizedCorrectionCount,
    correctionsApplied,
    source
  })

  if (correctionsApplied.length > 0 && writeResult?.ingestResult?.updated === true) {
    appliedAuditResult = await persistMetadataCorrectionAuditLog({
      collectionConceptId: collectionDetails.collectionConceptId,
      keywordEvent: auditKeywordEvent,
      nativeFormat,
      delegateName,
      corrections: correctionsApplied,
      status: 'applied'
    })

    logger.info('[metadata-correction] Persisted applied metadata correction audit log', {
      collectionConceptId: collectionDetails.collectionConceptId,
      messageId,
      nativeFormat,
      auditResult: appliedAuditResult
    })
  }

  logger.info('[metadata-correction] Completed corrected metadata write to CMR', {
    collectionConceptId: collectionDetails.collectionConceptId,
    messageId,
    nativeFormat,
    correctionCount: normalizedCorrectionCount,
    writeResult
  })

  return {
    outcome: 'processed',
    collectionConceptId: collectionDetails.collectionConceptId,
    providerId: collectionDetails.providerId,
    nativeId: collectionDetails.nativeId,
    revisionId: collectionDetails.revisionId,
    nativeFormat,
    keywordValidationFailureCount: keywordValidationFailures.length,
    keywordValidationFailures,
    resolvedCorrectionCount: resolvedCorrections.length,
    resolvedCorrections,
    correctionResult: {
      nativeFormat: rawCorrectionResult.nativeFormat || nativeFormat,
      delegateName,
      correctionCount: normalizedCorrectionCount,
      correctionsAppliedCount: correctionsApplied.length,
      correctionsApplied,
      correctedMetadataProduced: rawCorrectionResult.correctedMetadata !== undefined
        && rawCorrectionResult.correctedMetadata !== null
    },
    auditResults: {
      pending: pendingAuditResult,
      applied: appliedAuditResult
    },
    writeResult,
    source
  }
}

export default runCollectionMetadataCorrection
