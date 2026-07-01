import { createIso19115Editor, ISO_19115_SCHEME_EDITORS } from './Iso19115DomEditor'
/**
 * Stub ISO 19115 delegate for KMS-675.
 *
 * Real ISO 19115 mutation is follow-on work. For now this delegate only records the handoff
 * shape.
 */
export const applyIso19115MetadataCorrections = async (params) => {
  const {
    metadataPayload,
    corrections = []
  } = params

  if (!metadataPayload) {
    return {
      correctionCount: 0,
      correctedMetadata: undefined,
      correctionsApplied: [],
      stubbed: false
    }
  }

  const editor = createIso19115Editor(metadataPayload)
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
    stubbed: false
  }
}

export default applyIso19115MetadataCorrections
