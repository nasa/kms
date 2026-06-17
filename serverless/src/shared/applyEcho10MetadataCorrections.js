import { createEcho10Editor, ECHO10_SCHEME_EDITORS } from './echo10DomEditor'

/**
 * Applies ECHO10 keyword corrections through a DOM-backed editor.
 *
 * This intentionally avoids the old "XML -> generic JS object -> rebuild whole document"
 * flow. Instead, we parse the XML into a DOM once, locate the target ECHO10 node by its
 * current keyword value when possible, mutate only the affected node/field, and serialize
 * at the end. The shared XML path editor underneath is format-agnostic so the same engine
 * can be reused by later XML-native delegates.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.metadataPayload - The raw ECHO10 XML string to be corrected.
 * @param {Array<Object>} [params.corrections=[]] - Correction instructions.
 * @returns {Promise<Object>} Correction summary with the updated XML payload.
 */
export const applyEcho10MetadataCorrections = async (params) => {
  const {
    metadataPayload,
    corrections = []
  } = params

  if (!metadataPayload) {
    return {
      correctionCount: 0,
      stubbed: true
    }
  }

  const editor = createEcho10Editor(metadataPayload)
  const applied = corrections.reduce((acc, correction) => {
    const scheme = String(correction.scheme || '').toLowerCase()
    const delegate = ECHO10_SCHEME_EDITORS[scheme]

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

export default applyEcho10MetadataCorrections
