import { sparqlRequest } from './sparqlRequest'

/**
 * Retrieves details for a given concept scheme.
 *
 * @param {string} schemeName - The name of the concept scheme (e.g., "ChainedOperations")
 * @returns {Promise<Object>} A promise that resolves to an object containing the scheme details
 */
const getConceptSchemeDetails = async (schemeName) => {
  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms/>

    SELECT ?prefLabel ?notation ?modified ?csvHeaders
    WHERE {
      ?scheme a skos:ConceptScheme ;
              skos:notation "${schemeName}" ;
              skos:prefLabel ?prefLabel ;
              skos:notation ?notation ;
              dcterms:modified ?modified .
      OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
    }
  `

  try {
    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (result.results.bindings.length === 0) {
      return null // No results found
    }

    const binding = result.results.bindings[0]

    return {
      prefLabel: binding.prefLabel.value,
      notation: binding.notation.value,
      modified: binding.modified.value,
      csvHeaders: binding.csvHeaders ? binding.csvHeaders.value : null
    }
  } catch (error) {
    console.error('Error fetching concept scheme details:', error)
    throw error
  }
}

export default getConceptSchemeDetails
