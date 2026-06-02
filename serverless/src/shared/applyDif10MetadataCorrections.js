import { createDif10Editor, DIF10_SCHEME_EDITORS } from './dif10DomEditor'
import { ensureCorrectionKeywordObjects } from './redisPathStore'

/**
 * Applies DIF10 keyword corrections through a DOM-backed editor.
 *
 * This intentionally avoids the old "XML -> generic JS object -> rebuild whole document"
 * flow. Instead, we parse the XML into a DOM once, locate the target DIF10 node by its
 * current keyword value when possible, mutate only the affected node/field, and serialize
 * at the end. The shared XML path editor underneath is format-agnostic so the same engine
 * can be reused by later XML-native delegates.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.metadataPayload - The raw DIF10 XML string to be corrected.
 * @param {Array<Object>} [params.corrections=[]] - Correction instructions.
 * @returns {Promise<Object>} Correction summary with the updated XML payload.
 */
export const applyDif10MetadataCorrections = async (params) => {
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

  const editor = createDif10Editor(metadataPayload)
  const normalizedCorrections = corrections.map(
    (correction) => ensureCorrectionKeywordObjects(correction)
  )
  const applied = normalizedCorrections.reduce((acc, correction) => {
    const scheme = String(correction.scheme || '').toLowerCase()
    const delegate = DIF10_SCHEME_EDITORS[scheme]

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

export default applyDif10MetadataCorrections
