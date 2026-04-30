/**
 * Stub lookup for the future `/concept_uuid/short_name/{shortname}` KMS API.
 *
 * KMS-664 is expected to provide the real concept-uuid lookup. Until then, return the
 * extracted UMM-C value in the same placeholder shape we already carry through KMS-675.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.shortName - Short-name value extracted from UMM-C.
 * @returns {Promise<string>} Placeholder result that will later be replaced by a real UUID.
 */
export const getConceptUuidByShortName = async ({
  shortName
}) => {
  if (!shortName) {
    throw new Error('Missing short name for concept uuid lookup stub')
  }

  return `[resolve old keyword from UMM-C value: ${shortName}]`
}

export default getConceptUuidByShortName
