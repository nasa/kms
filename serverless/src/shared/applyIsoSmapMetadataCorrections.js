import { createIso19115Editor, ISO_19115_SCHEME_EDITORS } from './Iso19115DomEditor'

/**
 * Applies ISO SMAP metadata corrections.
 *
 * Uses the same editor infrastructure as ISO-MENDS, but with SMAP format option.
 * The editor automatically transforms XPath expressions to account for the
 * /gmd:DS_Series/gmd:seriesMetadata/ wrapper that SMAP uses.
 */
export const applyIsoSmapMetadataCorrections = async (params) => {
  const {
    metadataPayload,
    corrections = []
  } = params

  if (!metadataPayload) {
    return {
      ...params,
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: false
    }
  }

  // Create editor with SMAP format - automatically transforms XPath expressions
  const editor = createIso19115Editor(metadataPayload, { format: 'SMAP' })

  const applied = corrections.reduce((acc, correction) => {
    const scheme = String(correction.scheme || '').toLowerCase()
    const delegate = ISO_19115_SCHEME_EDITORS[scheme]

    if (!delegate) {
      return acc
    }

    const isUpdated = delegate(editor, correction)
    if (isUpdated) {
      acc.push(correction)
    }

    return acc
  }, [])

  return {
    ...params,
    correctionCount: applied.length,
    correctedMetadata: editor.serialize(),
    correctionsApplied: applied,
    stubbed: false // No longer stubbed!
  }
}

export default applyIsoSmapMetadataCorrections
