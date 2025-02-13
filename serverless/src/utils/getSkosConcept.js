import { sparqlRequest } from './sparqlRequest'
import toSkosJson from './toSkosJson'

/**
 * Retrieves and processes SKOS concept data for a given concept IRI.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to fetch all triples related to the given concept IRI.
 * 2. Sends a SPARQL request to retrieve the concept data.
 * 3. Processes the SPARQL results and converts them into a SKOS JSON format.
 *
 * The SPARQL query retrieves:
 * - All direct properties of the concept.
 * - All properties of blank nodes connected to the concept.
 *
 * @param {string} conceptIRI - The IRI (Internationalized Resource Identifier) of the SKOS concept to retrieve.
 *
 * @returns {Promise<Object>} A promise that resolves to the SKOS concept data in JSON format.
 *
 * @throws {Error} If the HTTP request fails, if no results are found for the concept,
 *                 or if there's an error during the fetching or processing of the concept data.
 *
 * @example
 * try {
 *   const conceptData = await getSkosConcept('http://example.com/concept/123');
 *   console.log(conceptData);
 * } catch (error) {
 *   console.error('Failed to get concept:', error);
 * }
 *
 * @see sparqlRequest - For details on how the SPARQL query is executed.
 * @see toSkosJson - For details on how the SPARQL results are converted to SKOS JSON.
 */
const getSkosConcept = async (conceptIRI) => {
  const sparqlQuery = `
SELECT DISTINCT ?s ?p ?o
WHERE {
  {
    <${conceptIRI}> ?p ?o .
    BIND(<${conceptIRI}> AS ?s)
  } 
  UNION 
  {
    <${conceptIRI}> ?p1 ?bnode .
    ?bnode ?p ?o .
    BIND(?bnode AS ?s)
    FILTER(isBlank(?bnode))
  }
}  `
  try {
    const response = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: sparqlQuery
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    if (json.results.bindings.length === 0) {
      throw new Error(`No results found for concept: ${conceptIRI}`)
    }

    return toSkosJson(conceptIRI, json.results.bindings)
  } catch (error) {
    console.error('Error fetching SKOS concept:', error)
    throw error
  }
}

export default getSkosConcept
