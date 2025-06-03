import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Captures all relevant relations for a given concept.
 * This function queries the triplestore to retrieve both outgoing and incoming relations
 * for a specified concept.
 *
 * @async
 * @function captureRelations
 * @param {string} conceptId - The UUID of the concept for which to capture relations
 * @param {string} version - The version of the concept (e.g., 'draft', 'published')
 * @param {string|null} [transactionUrl=null] - The transaction URL if within a transaction, null otherwise
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of relation objects
 * @throws {Error} If there's an issue fetching the relations from the triplestore
 *
 * @example
 * // Capture relations for a concept
 * const relations = await captureRelations('123e4567-e89b-12d3-a456-426614174000', 'draft');
 *
 * // Example of a returned relation object
 * // {
 * //   from: 'https://gcmd.earthdata.nasa.gov/kms/concept/123e4567-e89b-12d3-a456-426614174000',
 * //   relation: 'broader',
 * //   to: 'https://gcmd.earthdata.nasa.gov/kms/concept/789a1234-b56c-78d9-e012-345678901234'
 * // }
 *
 * @description
 * This function performs a SPARQL query to retrieve all relevant relations (broader, narrower,
 * related, hasInstrument, isOnPlatform) for the specified concept. It captures both outgoing
 * relations (where the concept is the subject) and incoming relations (where the concept is
 * the object). The function returns an array of relation objects, each containing 'from',
 * 'relation', and 'to' properties.
 */
export const captureRelations = async (conceptId, version, transactionUrl = null) => {
  function extractRelationName(uri) {
    return uri.split('#').pop()
  }

  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX gcmd: <http://gcmd.nasa.gov/schema/gcmd#>
    
    SELECT ?from ?relation ?to
    WHERE {
      {
        # Outgoing relations
        <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> ?relation ?to .
        BIND(<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> AS ?from)
        FILTER(?relation IN (skos:broader, skos:narrower, skos:related, gcmd:hasInstrument, gcmd:isOnPlatform))
      }
      UNION
      {
        # Incoming relations
        ?from ?relation <https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> .
        BIND(<https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}> AS ?to)
        FILTER(?relation IN (skos:broader, skos:narrower, skos:related, gcmd:hasInstrument, gcmd:isOnPlatform))
      }
    }
  `

  const response = await sparqlRequest({
    method: 'POST',
    contentType: 'application/sparql-query',
    accept: 'application/sparql-results+json',
    body: query,
    version,
    transaction: transactionUrl ? {
      transactionUrl,
      action: 'QUERY'
    } : null
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch relations: ${response.status}`)
  }

  const data = await response.json()

  return data.results.bindings.map((binding) => ({
    from: binding.from.value,
    relation: extractRelationName(binding.relation.value),
    to: binding.to.value
  }))
}
