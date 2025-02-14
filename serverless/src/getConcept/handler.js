import { XMLBuilder } from 'fast-xml-parser'
import { getApplicationConfig } from '../utils/getConfig'
import getSkosConcept from '../utils/getSkosConcept'
import getGcmdMetadata from '../utils/getGcmdMetadata'

/**
 * Retrieves a SKOS Concept by its ID and returns it as RDF/XML.
 *
 * This function fetches a SKOS concept from the RDF store using its ID,
 * constructs an RDF/XML representation of the concept, and returns it in the response.
 *
 * @async
 * @function getConcept
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} event.pathParameters.conceptId - The ID of the concept to retrieve.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object
 * const event = {
 *   pathParameters: { conceptId: '123' }
 * };
 *
 * const result = await getConcept(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" ...>...</rdf:RDF>',
 * //   headers: { ... }
 * // }
 */
const getConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId } = pathParameters

  try {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`
    const concept = await getSkosConcept(conceptIRI)
    const rdfJson = {
      'rdf:RDF': {
        '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
        '@xmlns:kms': 'https://gcmd.earthdata.nasa.gov/kms#',
        'gcmd:gcmd': await getGcmdMetadata({ conceptIRI }),
        'skos:Concept': [concept]

      }
    }

    const xml = await builder.build(rdfJson)

    return {
      body: xml,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
      }
    }
  } catch (error) {
    console.error(`Error retrieving concept, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getConcept
