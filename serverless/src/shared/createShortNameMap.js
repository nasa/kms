import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches all SKOS concepts and their corresponding scheme short names.
 *
 * @async
 * @function createConceptSchemeMap
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where keys are SKOS concept identifiers and values are their scheme short names.
 * @throws Will throw an error if the SPARQL request or parsing fails.
 */
export const createShortNameMap = async () => {
  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?concept ?schemeShortName
    WHERE {
      ?concept a skos:Concept ;
               skos:inScheme ?scheme .
      ?scheme skos:notation ?schemeShortName .
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

    const data = await response.json()
    const conceptSchemeMap = new Map()

    data.results.bindings.forEach((binding) => {
      const fullConceptUri = binding.concept.value
      const conceptId = fullConceptUri.split('/').pop()
      const schemeShortName = binding.schemeShortName.value
      conceptSchemeMap.set(conceptId, schemeShortName)
    })

    return conceptSchemeMap
  } catch (error) {
    console.error('Error fetching concept scheme mappings:', error)
    throw error
  }
}
