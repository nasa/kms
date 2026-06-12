import { createUmmcEditor, UMMC_SCHEME_EDITORS } from './ummcDomEditor'

/**
 * Applies UMM-C keyword corrections through a JSON-backed editor.
 *
 * This intentionally avoids the old "JSON -> generic JS object -> rebuild whole document"
 * flow. Instead, we parse the JSON once, locate the target UMM-C node by its
 * current keyword value when possible, mutate only the affected node/field, and serialize
 * at the end. The shared JSON path editor underneath is format-agnostic so the same engine
 * can be reused by later JSON-native delegates.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.metadataPayload - The raw UMM-C JSON string to be corrected.
 * @param {Array<Object>} [params.corrections=[]] - Correction instructions.
 * @returns {Promise<Object>} Correction summary with the updated JSON payload.
 */
export const applyUmmcMetadataCorrections = async (params) => {
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

  let jsonMetadataPayload = metadataPayload

  if (typeof metadataPayload === 'string') {
    jsonMetadataPayload = JSON.parse(metadataPayload)
  }

  const editor = createUmmcEditor(jsonMetadataPayload)
  const applied = corrections.reduce((acc, correction) => {
    const scheme = String(correction.scheme || '').toLowerCase()
    const delegate = UMMC_SCHEME_EDITORS[scheme]

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

export default applyUmmcMetadataCorrections
