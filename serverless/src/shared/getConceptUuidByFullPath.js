/**
 * Stub lookup for the future `/concept_uuid/full_path/{full_path}` KMS API.
 *
 * KMS-664 is expected to provide the real concept-uuid lookup. Until then, return the
 * extracted UMM-C value in the same placeholder shape we already carry through KMS-675.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.fullPath - Hierarchy or path value extracted from UMM-C.
 * @returns {Promise<string>} Placeholder result that will later be replaced by a real UUID.
 */
export const getConceptUuidByFullPath = async ({
  fullPath
}) => {
  if (!fullPath) {
    throw new Error('Missing full path for concept uuid lookup stub')
  }

  return `[resolve old keyword from UMM-C value: ${fullPath}]`
}

export default getConceptUuidByFullPath
