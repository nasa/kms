import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches all SKOS concept definitions and returns a map of identifiers to definition objects.
 *
 * @async
 * @function createDefinitionsMap
 * @returns {Promise<Map<string, Object>>} A promise that resolves to a Map where keys are SKOS concept identifiers and values are their definition objects.
 * @throws Will throw an error if the SPARQL request or parsing fails.
 */
export const createDefinitionsMap = async () => {
  const query = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    SELECT ?concept ?definition ?reference
    WHERE {
      ?concept a skos:Concept ;
               skos:definition ?definition .
      OPTIONAL { ?concept gcmd:reference ?reference }
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
    const definitionsMap = new Map()

    data.results.bindings.forEach((binding) => {
      const fullConceptUri = binding.concept.value
      const conceptId = fullConceptUri.split('/').pop()
      const definition = {
        text: binding.definition.value,
        reference: binding.reference ? binding.reference.value : ''
      }
      definitionsMap.set(conceptId, definition)
    })

    return definitionsMap
  } catch (error) {
    console.error('Error fetching SKOS definitions:', error)
    throw error
  }
}
