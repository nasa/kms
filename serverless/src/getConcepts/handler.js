import { XMLBuilder } from 'fast-xml-parser'
import { getApplicationConfig } from '../utils/getConfig'
import getFilteredTriples from '../utils/getFilteredTriples'
import toSkosJson from '../utils/toSkosJson'
import processTriples from '../utils/processTriples'
import getGcmdMetadata from '../utils/getGcmdMetadata'

/**
 * Retrieves multiple SKOS Concepts and returns them as RDF/XML.
 *
 * This function fetches all SKOS concepts from the RDF store,
 * processes them, and constructs an RDF/XML representation of the concepts.
 * It limits the output to 2000 concepts to manage response size.
 *
 * @async
 * @function getConcepts
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * const result = await getConcepts();
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" ...>...</rdf:RDF>',
 * //   headers: { ... }
 * // }
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
      'rdf:RDF': {
        '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
        '@xmlns:kms': 'https://gcmd.earthdata.nasa.gov/kms#',
        'gcmd:gcmd': await getGcmdMetadata({ gcmdHits: fullURIs.length }),
        'skos:Concept': concepts
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

export default getConcepts
