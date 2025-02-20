import { sparqlRequest } from './sparqlRequest'

/**
 * Retrieves all triples from the configured SPARQL endpoint.   This function will
 * eventually be passed a filter to limit the triples returned.
 *
 * This function performs the following operations:
 * 1. Constructs a SPARQL query to fetch all triples in the database given the specified filter (filter work tbd)
 * 2. Sends a request to the SPARQL endpoint using sparqlRequest.
 * 3. Processes and returns the SPARQL query results.
 *
 * The SPARQL query used is a simple SELECT that retrieves all distinct subject-predicate-object triples.
 *
 * @returns {Promise<Array>} A promise that resolves to an array of triple objects.
 *                           Each triple object contains 's' (subject), 'p' (predicate), and 'o' (object) properties.
 *
 * @throws {Error} If the HTTP request fails, if the response is not ok,
 *                 or if there's any error during the fetching or processing of the triples.
 *
 * @example
 * try {
 *   const triples = await getFilteredTriples();
 *   console.log(triples);
 * } catch (error) {
 *   console.error('Failed to get triples:', error);
 * }
 *
 * @see getApplicationConfig - Used to retrieve the SPARQL endpoint URL.
 * @see sparqlRequest - Used to make the SPARQL query request.
 */

const getFilteredTriples = async ({ conceptScheme, pattern }) => {
  const prefixes = `
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
`

  const selectClause = `
  SELECT DISTINCT ?s ?p ?o
`

  const createWhereClause = () => {
    const conditions = [
      '?s rdf:type skos:Concept' // This ensures we only get skos:Concept triples
    ]

    if (conceptScheme) {
      conditions.push(`?s skos:inScheme <https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${conceptScheme}>`)
    }

    if (pattern) {
      conditions.push('?s skos:prefLabel ?prefLabel')
      conditions.push(`FILTER(CONTAINS(LCASE(?prefLabel), LCASE("${pattern}")))`)
    }

    const directPattern = `
      ${conditions.join(' .\n    ')} .
      ?s ?p ?o .
    `

    const blankNodePattern = `
      ${conditions.map((c) => c.replace(/\?s/g, '?original')).join(' .\n    ')} .
      ?original ?p1 ?s .
      ?s ?p ?o .
      FILTER(isBlank(?s))
    `

    return `
    WHERE {
      {
        ${directPattern}
      }
      UNION
      {
        ${blankNodePattern}
      }
    }
  `
  }

  const sparql = `
  ${prefixes}
  ${selectClause}
  ${createWhereClause()}
`

  try {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: sparql
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    return json.results.bindings
  } catch (error) {
    console.error('Error fetching triples:', error)
    throw error
  }
}

export default getFilteredTriples
