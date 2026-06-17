import { applyDif10MetadataCorrections } from './applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from './applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from './applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from './applyIsoSmapMetadataCorrections'
import { applyUmmMetadataCorrections } from './applyUmmMetadataCorrections'
import { logger } from './logger'

const STATIC_METADATA_CORRECTION_DELEGATES = {
  ISO19115: applyIso19115MetadataCorrections,
  ISO_SMAP: applyIsoSmapMetadataCorrections,
  ECHO10: applyEcho10MetadataCorrections,
  DIF10: applyDif10MetadataCorrections
}

const normalizeKeywordObject = (keywordObject) => (
  keywordObject
  && typeof keywordObject === 'object'
  && !Array.isArray(keywordObject)
    ? keywordObject
    : {}
)

const normalizeCorrection = (correction) => {
  const safeCorrection = correction || {}

  return {
    scheme: safeCorrection.scheme,
    action: safeCorrection.action,
    keywordConceptUuid: safeCorrection.keywordConceptUuid,
    oldKeywordObject: normalizeKeywordObject(safeCorrection.oldKeywordObject),
    newKeywordObject: normalizeKeywordObject(safeCorrection.newKeywordObject),
    ummPath: safeCorrection.ummPath,
    oldLongName: safeCorrection.oldLongName,
    newLongName: safeCorrection.newLongName
  }
}

const hasMeaningfulKeywordValue = (keywordObject) => Object.values(keywordObject)
  .some((value) => String(value || '').trim().length > 0)

const shouldSkipCorrection = (correction) => {
  const normalizedAction = String(correction.action || '').trim().toLowerCase()

  return (
    normalizedAction === 'replace'
    && !hasMeaningfulKeywordValue(correction.newKeywordObject)
  )
}

const normalizeCorrections = (corrections = []) => (
  Array.isArray(corrections)
    ? corrections
      .map((correction) => normalizeCorrection(correction))
      .filter((correction) => {
        if (!shouldSkipCorrection(correction)) {
          return true
        }

        logger.error('[metadata-correction] Skipping invalid replacement correction payload', {
          scheme: correction.scheme,
          action: correction.action,
          keywordConceptUuid: correction.keywordConceptUuid,
          oldKeywordObject: correction.oldKeywordObject,
          newKeywordObject: correction.newKeywordObject
        })

        return false
      })
    : []
)

/**
 * True when the current process is running in the repo's local LocalStack mode.
 *
 * @returns {boolean} `true` when local-only metadata delegates may be used.
 */
const isLocalMetadataCorrectionMode = () => (
  String(process.env.USE_LOCALSTACK || '').toLowerCase() === 'true'
  || String(process.env.useLocalstack || '').toLowerCase() === 'true'
)

/**
 * True when a native format currently has a registered metadata-correction delegate.
 *
 * This is the shared source of truth for format support. The collection runner uses it for an
 * early, user-facing unsupported-format failure, while the delegate dispatcher uses the same
 * support matrix to choose the concrete mutator implementation.
 *
 * @param {string} nativeFormat Normalized native format label.
 * @returns {boolean} `true` when the format is currently supported.
 */
export const isMetadataCorrectionDelegateSupported = (nativeFormat) => {
  const normalizedNativeFormat = String(nativeFormat || '').trim().toUpperCase()

  if (normalizedNativeFormat === 'UMM') {
    return isLocalMetadataCorrectionMode()
  }

  return Boolean(STATIC_METADATA_CORRECTION_DELEGATES[normalizedNativeFormat])
}

const getMetadataCorrectionDelegate = (nativeFormat) => {
  const normalizedNativeFormat = String(nativeFormat || '').trim().toUpperCase()

  if (normalizedNativeFormat === 'UMM') {
    if (isLocalMetadataCorrectionMode()) {
      return applyUmmMetadataCorrections
    }

    throw new Error(
      `Unsupported native metadata format for delegate selection: ${nativeFormat}`
    )
  }

  const delegate = STATIC_METADATA_CORRECTION_DELEGATES[normalizedNativeFormat]

  if (delegate) {
    return delegate
  }

  throw new Error(
    `Unsupported native metadata format for delegate selection: ${nativeFormat}`
  )
}

/**
 * Routes correction plans to the appropriate native-format delegate.
 *
 * By the time this helper is called, the metadata-correction service has already:
 * - fetched the collection metadata
 * - validated supported keywords
 * - resolved invalid keywords into concrete replace/delete actions
 *
 * The remaining job is format-specific mutation. This helper provides that dispatch seam by
 * selecting the delegate that understands the collection's normalized native format and handing
 * it the correction plan plus any format-specific metadata payload it needs.
 *
 * Each correction is normalized into one shared contract before delegation so every native-format
 * handler receives the same correction fields, even when only a subset is meaningful for that
 * format. Unknown correction fields are intentionally dropped at this seam.
 *
 * That keeps the orchestration layer format-agnostic while allowing each delegate to own the
 * mechanics of mutating local-only UMM smoke payloads plus ISO19115, ISO SMAP, ECHO10, or
 * DIF10 metadata.
 *
 * @param {object} params - Delegate parameters.
 * @param {'UMM'|'ISO19115'|'ISO_SMAP'|'ECHO10'|'DIF9'|'DIF10'|'UNKNOWN'} params.nativeFormat - Normalized native format.
 * @returns {Promise<object>} Delegate result returned by the selected format-specific handler.
 * @throws {Error} If the native format does not have a registered delegate.
 */
export const invokeMetadataCorrectionDelegate = async ({
  nativeFormat,
  ...delegateParams
}) => {
  const delegate = getMetadataCorrectionDelegate(nativeFormat)
  const normalizedDelegateParams = {
    ...delegateParams,
    corrections: normalizeCorrections(delegateParams.corrections)
  }

  return delegate(normalizedDelegateParams)
}

export default invokeMetadataCorrectionDelegate
