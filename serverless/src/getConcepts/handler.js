import { XMLBuilder } from 'fast-xml-parser'

import { namespaces } from '@/shared/constants/namespaces'
import { createCsvForScheme } from '@/shared/createCsvForScheme'
import { getApplicationConfig } from '@/shared/getConfig'
import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getRootConcepts } from '@/shared/getRootConcepts'
import { processTriples } from '@/shared/processTriples'
import { toSkosJson } from '@/shared/toSkosJson'

/**
 * Retrieves multiple SKOS Concepts and returns them as RDF/XML.
 *
 * This function fetches all SKOS concepts from the RDF store,
 * processes them, and constructs an RDF/XML representation of the concepts.
 * It limits the output to 2000 concepts to manage response size.  Paging
 * is not supported yet.
 *
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
export const getConcepts = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event
  const { conceptScheme, pattern } = event?.pathParameters || {}
  const { page_num: pageNumStr = '1', page_size: pageSizeStr = '2000' } = event?.queryStringParameters || {}

  if (queryStringParameters?.format === 'csv') {
    if (!conceptScheme) {
      return {
        headers: defaultResponseHeaders,
        statusCode: 400,
        body: JSON.stringify({ error: 'Scheme parameter is required for CSV format' })
      }
    }

    if (pattern) {
      return {
        headers: defaultResponseHeaders,
        statusCode: 400,
        body: JSON.stringify({ error: 'Pattern parameter is not allowed for CSV format' })
      }
    }

    return createCsvForScheme(conceptScheme)
  }

  // Convert page_num and page_size to integers
  const pageNum = parseInt(pageNumStr, 10)
  const pageSize = parseInt(pageSizeStr, 10)

  // Validate page_num and page_size
  if (Number.isNaN(pageNum) || pageNum < 1
  || pageNum !== Number(pageNumStr)) {
    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid page_num parameter' })
    }
  }

  if (Number.isNaN(pageSize)
  || pageSize < 1 || pageSize > 2000
  || pageSize !== Number(pageSizeStr)) {
    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid page_size parameter. Must be between 1 and 2000.' })
    }
  }

  try {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })
    let triples
    if (event?.path === '/concepts/root') {
      triples = await getRootConcepts()
    } else {
      triples = await getFilteredTriples({
        conceptScheme,
        pattern
      })
    }

    const { bNodeMap, nodes, conceptURIs: fullURIs } = processTriples(triples)

    const totalConcepts = fullURIs.length
    const totalPages = Math.ceil(totalConcepts / pageSize)

    // Calculate start and end indices for the current page
    const startIndex = (pageNum - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, totalConcepts)

    const concepts = []
    const conceptURIs = fullURIs.slice(startIndex, endIndex)
    conceptURIs.forEach((uri) => {
      const ntriples = [...nodes[uri]]
      concepts.push(toSkosJson(uri, ntriples, bNodeMap))
    })

    const rdfJson = {
      'rdf:RDF': {
        ...namespaces,
        'gcmd:gcmd': await getGcmdMetadata({
          pageNum,
          pageSize,
          gcmdHits: fullURIs.length
        }),
        'skos:Concept': concepts
      }
    }

    const xml = await builder.build(rdfJson)

    return {
      statusCode: 200,
      body: xml,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'X-Total-Count': totalConcepts.toString(),
        'X-Page-Number': pageNum.toString(),
        'X-Page-Size': pageSize.toString(),
        'X-Total-Pages': totalPages.toString()
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
