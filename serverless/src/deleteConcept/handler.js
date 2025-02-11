import { getApplicationConfig } from '../utils/getConfig'
import { sparqlRequest } from '../utils/sparqlRequest'

/**
 * Deletes a SKOS Concept based on its rdf:about identifier
 * @param {Object} event Details about the HTTP request that it received
 */
const deleteConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId } = pathParameters

  // Construct the full IRI
  const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

  // Construct the SPARQL DELETE query
  const deleteQuery = `
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    DELETE {
      ?s ?p ?o .
    }
    WHERE {
      ?s ?p ?o .
      FILTER(?s = <${conceptIRI}>)
    }
  `

  try {
    const response = await sparqlRequest({
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      path: '/statements',
      method: 'POST',
      body: deleteQuery
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.log('Response text:', responseText)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log(`Successfully deleted concept: ${conceptId}`)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully deleted concept: ${conceptId}` }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error deleting concept:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting concept',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default deleteConcept
