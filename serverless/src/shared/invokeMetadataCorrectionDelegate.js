import { applyDif10MetadataCorrections } from './applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from './applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from './applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from './applyIsoSmapMetadataCorrections'
import { applyUmmMetadataCorrections } from './applyUmmMetadataCorrections'

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
 * That keeps the orchestration layer format-agnostic while allowing each delegate to own the
 * mechanics of mutating UMM, ISO19115, ISO SMAP, ECHO10, or DIF10 metadata.
 *
 * @param {object} params - Delegate parameters.
 * @param {'UMM'|'ISO19115'|'ISO_SMAP'|'ECHO10'|'DIF10'|'UNKNOWN'} params.nativeFormat - Normalized native format.
 * @returns {Promise<object>} Delegate result returned by the selected format-specific handler.
 * @throws {Error} If the native format does not have a registered delegate.
 */
export const invokeMetadataCorrectionDelegate = async ({
  nativeFormat,
  ...delegateParams
}) => {
  switch (nativeFormat) {
    case 'UMM':
      return applyUmmMetadataCorrections(delegateParams)
    case 'ISO19115':
      return applyIso19115MetadataCorrections(delegateParams)
    case 'ISO_SMAP':
      return applyIsoSmapMetadataCorrections(delegateParams)
    case 'ECHO10':
      return applyEcho10MetadataCorrections(delegateParams)
    case 'DIF10':
      return applyDif10MetadataCorrections(delegateParams)
    default:
      throw new Error(`Unsupported native metadata format for delegate selection: ${nativeFormat}`)
  }
}

export default invokeMetadataCorrectionDelegate
