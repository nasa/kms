import prefixes from '@/shared/constants/prefixes'

/**
 * Generates a SPARQL query to create relationships between concepts, checking for existence first.
 *
 * @param {Object} params - The parameters for creating the relationship.
 * @param {string} params.sourceUuid - The UUID of the source concept.
 * @param {string[]} params.targetUuids - An array of UUIDs of the target concepts.
 * @param {string} params.relationship - The relationship predicate to be used.
 * @returns {string} The complete SPARQL query string for creating the relationships.
 */
export const getCreateRelationshipQuery = ({
  sourceUuid, targetUuids, relationship
}) => {
  const createTriples = () => targetUuids.map((uuid) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> ${relationship} <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}>`).join(' .\n    ')

  return `
  ${prefixes}
  INSERT {
    ${createTriples()}
  }
  WHERE {
    <https://gcmd.earthdata.nasa.gov/kms/concept/${sourceUuid}> a ?sourceType .
    ${targetUuids.map((uuid, index) => `<https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}> a ?targetType${index + 1} .`).join('\n    ')}
    FILTER NOT EXISTS {
      ${createTriples()}
    }
  }
  `
}
