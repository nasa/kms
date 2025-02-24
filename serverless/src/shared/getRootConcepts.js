import { getRootConceptsQuery } from '@/shared/operations/queries/getRootConceptsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves all triples for root SKOS concepts (concepts without a broader concept).
 *
 * @async
 * @function getRootConcepts
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects for root concepts.
 * @throws {Error} If there's an error during the SPARQL request or processing of the response.
 */
export const getRootConcepts = async () => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getRootConceptsQuery()
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    return result.results.bindings
  } catch (error) {
    console.error('Error fetching root concepts:', error)
    throw error
  }
}
