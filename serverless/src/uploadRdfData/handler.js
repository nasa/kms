import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Uploads RDF/XML data to the SPARQL endpoint.
 *
 * This function does not delete existing triples associated with the concepts
 * before adding new ones. It overlays new triples on top of existing data, which may
 * result in duplicate or conflicting information if not managed carefully. To completely
 * replace existing data, consider using a separate delete operation before uploading new data.
 *
 * @async
 * @function uploadRdfData
 * @param {Object} event - The Lambda event object.
 * @param {string} event.body - The RDF/XML data to be uploaded.
 * @param {Object} [event.queryStringParameters] - Query string parameters.
 * @param {string} [event.queryStringParameters.version='draft'] - The version to update (default is 'draft').
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   body: '<rdf:RDF>...</rdf:RDF>',
 *   queryStringParameters: { version: 'draft' }
 * };
 *
 * const result = await uploadRdfData(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully loaded RDF data into RDF4J"}',
 * //   headers: { ... }
 * // }
 *
 * @example
 * // Curl usage example:
 * // curl -X POST https://your-api-endpoint/dev/upload-rdf \
 * //   -H "Content-Type: application/xml" \
 * //   -d @your-rdf-file.xml \
 * //   -G --data-urlencode "version=draft"
 *
 * @warning This function does not delete existing triples associated with the concepts
 * before adding new ones. It overlays new triples on top of existing data, which may
 * result in duplicate or conflicting information if not managed carefully. To completely
 * replace existing data, consider using a separate delete operation before uploading new data.
 */
export const uploadRdfData = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { body: rdfXml, queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'draft'

  if (!rdfXml || typeof rdfXml !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid input: RDF/XML data is required' }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  }

  try {
    const response = await sparqlRequest({
      contentType: 'application/rdf+xml',
      accept: 'application/rdf+xml',
      method: 'POST',
      body: rdfXml,
      version
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.error('Error response:', responseText)

      return {
        statusCode: response.status,
        body: JSON.stringify({
          message: `Error from SPARQL endpoint: ${responseText}`
        }),
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        }
      }
    }

    console.log('Successfully loaded RDF data into RDF4J')

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully loaded RDF data into RDF4J'
      }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('Error loading RDF data into RDF4J:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error loading RDF XML into RDF4J',
        error: error.message
      }),
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      }
    }
  }
}

export default uploadRdfData
