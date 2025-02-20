import { sparqlRequest } from './sparqlRequest'

/**
 * Retrieves details for concept schemes.
 *
 * @param {string} [schemeName] - The name of the concept scheme (e.g., "ChainedOperations"). If not provided, returns all concept schemes.
 * @returns {Promise<Object|Array<Object>>} A promise that resolves to an object (for a single scheme) or an array of objects (for all schemes) containing the scheme details
 */
const getConceptSchemeDetails = async (schemeName = null) => {
  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms/>

    SELECT ?scheme ?prefLabel ?notation ?modified ?csvHeaders
    WHERE {
      ?scheme a skos:ConceptScheme ;
              skos:prefLabel ?prefLabel ;
              skos:notation ?notation ;
              dcterms:modified ?modified .
      OPTIONAL { ?scheme gcmd:csvHeaders ?csvHeaders }
      ${schemeName ? `FILTER(?notation = "${schemeName}")` : ''}
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

    const processBinding = (binding) => ({
      uri: binding.scheme.value,
      prefLabel: binding.prefLabel.value,
      notation: binding.notation.value,
      modified: binding.modified.value,
      csvHeaders: binding.csvHeaders ? binding.csvHeaders.value : null
    })

    if (schemeName) {
      // Return a single object if a specific scheme was requested
      return processBinding(result.results.bindings[0])
    }

    // Return an array of all concept schemes
    return result.results.bindings.map(processBinding)
  } catch (error) {
    console.error('Error fetching concept scheme details:', error)
    throw error
  }
}

export default getConceptSchemeDetails
