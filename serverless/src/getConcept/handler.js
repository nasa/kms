import { XMLBuilder } from 'fast-xml-parser'
import { getApplicationConfig } from '../utils/getConfig'
import getSkosConcept from '../utils/getSkosConcept'

/**
 * Fetches a single SKOS Concept
 * @param {Object} event Details about the HTTP request that it received
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

    const rdfJson = {
      rdf: {
        '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
        '@xmlns:kms': 'https://gcmd.earthdata.nasa.gov/kms#',
        'skos:Concept': [await getSkosConcept(conceptIRI)]
      }
    }

    const xml = await builder.build(rdfJson)

    return {
      body: xml,
      headers: defaultResponseHeaders
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
