import { XMLBuilder } from 'fast-xml-parser'
import { getApplicationConfig } from '../utils/getConfig'
import getFilteredTriples from '../utils/getFilteredTriples'
import toSkosJson from '../utils/toSkosJson'
import processTriples from '../utils/processTriples'

/**
 * Fetches a single SKOS Concept
 * @param {Object} event Details about the HTTP request that it received
 */
const getConcepts = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()

  try {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    const triples = await getFilteredTriples()
    const { bNodeMap, nodes, conceptURIs: fullURIs } = processTriples(triples)

    const concepts = []

    const conceptURIs = fullURIs.splice(0, 2000)
    conceptURIs.forEach((uri) => {
      const ntriples = [...nodes[uri]]
      concepts.push(toSkosJson(uri, ntriples, bNodeMap))
    })

    const rdfJson = {
      rdf: {
        '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
        '@xmlns:kms': 'https://gcmd.earthdata.nasa.gov/kms#',
        'skos:Concept': concepts
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

export default getConcepts
