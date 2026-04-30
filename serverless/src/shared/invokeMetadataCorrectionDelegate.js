import { applyDif10MetadataCorrections } from './applyDif10MetadataCorrections'
import { applyEcho10MetadataCorrections } from './applyEcho10MetadataCorrections'
import { applyIso19115MetadataCorrections } from './applyIso19115MetadataCorrections'
import { applyIsoSmapMetadataCorrections } from './applyIsoSmapMetadataCorrections'
import { applyUmmMetadataCorrections } from './applyUmmMetadataCorrections'

/**
 * Routes correction plans to the appropriate native-format delegate.
 *
 * @param {object} params - Delegate parameters.
 * @param {'UMM'|'ISO19115'|'ISO_SMAP'|'ECHO10'|'DIF10'|'UNKNOWN'} params.nativeFormat - Normalized native format.
 * @returns {Promise<object>} Delegate result.
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
