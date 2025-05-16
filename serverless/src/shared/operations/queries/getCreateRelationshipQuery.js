import prefixes from '@/shared/constants/prefixes'

/**
 * Generates a SPARQL query to create relationships between concepts.
 *
 * @param {Object} params - The parameters for creating the relationship.
 * @param {string} params.sourceUuid - The UUID of the source concept.
 * @param {string[]} params.targetUuids - An array of UUIDs of the target concepts.
 * @param {string} params.relationship - The relationship predicate to be used.
 * @returns {string} The complete SPARQL query string for creating the relationships.
 *
 * @example
 * const query = createRelationshipQuery({
 *   sourceUuid: '1234-5678-90ab-cdef',
 *   targetUuids: ['abcd-efgh-ijkl-mnop', 'qrst-uvwx-yz12-3456'],
 *   relationship: 'skos:broader'
 * });
 *
 * // The resulting query will be:
 * // [prefixes]
 * // INSERT DATA {
 * //   <https://gcmd.earthdata.nasa.gov/kms/concept/abcd-efgh-ijkl-mnop> skos:broader <https://gcmd.earthdata.nasa.gov/kms/concept/1234-5678-90ab-cdef> .
 * //   <https://gcmd.earthdata.nasa.gov/kms/concept/qrst-uvwx-yz12-3456> skos:broader <https://gcmd.earthdata.nasa.gov/kms/concept/1234-5678-90ab-cdef> .
 * // }
 */
export const createRelationshipQuery = ({
  sourceUuid, targetUuids, relationship
}) => {
  const createTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}>`).join(' .\n    ')

  return `
  ${prefixes}
  INSERT DATA {
    ${createTriples()}
  }
  `
}
