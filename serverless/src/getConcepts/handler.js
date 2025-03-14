/* eslint-disable no-underscore-dangle */
import { XMLBuilder } from 'fast-xml-parser'

import { namespaces } from '@/shared/constants/namespaces'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import {
  createConceptToConceptSchemeShortNameMap
} from '@/shared/createConceptToConceptSchemeShortNameMap'
import { createCsvForScheme } from '@/shared/createCsvForScheme'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getRootConcepts } from '@/shared/getRootConcepts'
import { processTriples } from '@/shared/processTriples'
import { toLegacyJSON } from '@/shared/toLegacyJSON'
import { toSkosJson } from '@/shared/toSkosJson'

/**
 * Retrieves multiple SKOS Concepts and returns them in the specified format.
 *
 * This function fetches SKOS concepts from the RDF store based on the provided parameters,
 * processes them, and constructs a representation of the concepts in the requested format.
 * It supports pagination and various output formats.
 *
 * @async
 * @function getConcepts
 * @param {Object} event - The Lambda event object.
 * @param {Object} [event.pathParameters] - The path parameters from the API Gateway event.
 * @param {string} [event.pathParameters.conceptScheme] - The concept scheme to filter by.
 * @param {string} [event.pathParameters.pattern] - The pattern to filter concepts by.
 * @param {Object} [event.queryStringParameters] - The query string parameters from the API Gateway event.
 * @param {string} [event.queryStringParameters.page_num='1'] - The page number for pagination.
 * @param {string} [event.queryStringParameters.page_size='2000'] - The page size for pagination (max 2000).
 * @param {string} [event.queryStringParameters.format='rdf'] - The output format (rdf, json, xml, or csv).
 * @param {string} [event.queryStringParameters.version='published'] - The version of the concepts to retrieve.
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object for retrieving concepts
 * const event = {
 *   pathParameters: { conceptScheme: 'sciencekeywords' },
 *   queryStringParameters: {
 *     page_num: '1',
 *     page_size: '100',
 *     format: 'json',
 *     version: 'published'
 *   }
 * };
 *
 * const result = await getConcepts(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '...', // Content depends on the requested format
 * //   headers: {
 * //     'Content-Type': 'application/json; charset=utf-8',
 * //     'X-Total-Count': '1000',
 * //     'X-Page-Number': '1',
 * //     'X-Page-Size': '100',
 * //     'X-Total-Pages': '10'
 * //   }
 * // }
 *
 * @throws {Error} If there's an error retrieving or processing the concepts.
 */
export const getConcepts = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event
  const { conceptScheme, pattern } = event?.pathParameters || {}
  const { page_num: pageNumStr = '1', page_size: pageSizeStr = '2000', format = 'rdf' } = event?.queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'

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
    let triples
    if (event?.path === '/concepts/root') {
      triples = await getRootConcepts(version)
    } else {
      triples = await getFilteredTriples({
        conceptScheme,
        pattern,
        version
      })
    }

    const { bNodeMap, nodes, conceptURIs: fullURIs } = processTriples(triples)

    const totalConcepts = fullURIs.length
    const totalPages = Math.ceil(totalConcepts / pageSize)

    // Calculate start and end indices for the current page
    const startIndex = (pageNum - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, totalConcepts)
    const conceptURIs = fullURIs.slice(startIndex, endIndex)
    const prefLabelMap = await createPrefLabelMap(version)
    const conceptToConceptSchemeShortNameMap = await createConceptToConceptSchemeShortNameMap(version)

    let responseBody
    let contentType

    // Handle different formats based on queryStringParameter 'format'
    if (format.toLowerCase() === 'json') {
      const conceptSchemeMap = await createConceptSchemeMap(event)
      const jsonResponse = {
        hits: totalConcepts,
        page_num: pageNum,
        page_size: pageSize,
        termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
        keywordVersion: '20.8',
        viewer: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all',
        concepts: conceptURIs.map((uri) => {
          const ntriples = [...nodes[uri]]
          const concept = toSkosJson(uri, ntriples, bNodeMap)
          const legacyJSON = toLegacyJSON(
            concept,
            conceptSchemeMap,
            conceptToConceptSchemeShortNameMap,
            prefLabelMap
          )

          return {
            uuid: legacyJSON.uuid,
            prefLabel: legacyJSON.prefLabel,
            scheme: {
              shortName: legacyJSON.scheme.shortName,
              longName: legacyJSON.scheme.longName
            },
            definitions: legacyJSON.definitions
          }
        })
      }
      responseBody = JSON.stringify(jsonResponse, null, 2)
      contentType = 'application/json'
    } else if (format.toLowerCase() === 'csv') {
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

      return createCsvForScheme(conceptScheme, version)
    } else if (format.toLowerCase() === 'xml') {
      const xmlBuilder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        indentBy: '  ',
        attributeNamePrefix: '@',
        suppressEmptyNode: true
      })

      const xmlObj = {
        concepts: {
          '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@xsi:noNamespaceSchemaLocation': 'https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd',
          hits: totalConcepts,
          page_num: pageNum,
          page_size: pageSize,
          termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
          keywordVersion: '20.8',
          viewer: 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all',
          conceptBrief: conceptURIs.map((uri) => {
            const concept = toSkosJson(uri, [...nodes[uri]], bNodeMap)
            const schemeShortName = conceptToConceptSchemeShortNameMap.get(concept['@rdf:about'])

            return {
              '@conceptScheme': schemeShortName,
              '@prefLabel': concept['skos:prefLabel']._text,
              '@uuid': concept['@rdf:about']
            }
          })
        }
      }

      responseBody = xmlBuilder.build(xmlObj)
      contentType = 'application/xml'
    } else {
      // Default case (including 'rdf')
      const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        indentBy: '  ',
        attributeNamePrefix: '@',
        suppressEmptyNode: true,
        textNodeName: '_text'
      })

      const concepts = conceptURIs.map((uri) => {
        const ntriples = [...nodes[uri]]

        return toSkosJson(uri, ntriples, bNodeMap)
      })

      const rdfJson = {
        'rdf:RDF': {
          ...namespaces,
          'gcmd:gcmd': await getGcmdMetadata({
            pageNum,
            pageSize,
            gcmdHits: totalConcepts,
            version
          }),
          'skos:Concept': concepts
        }
      }

      responseBody = builder.build(rdfJson)
      contentType = 'application/xml'
    }

    return {
      statusCode: 200,
      body: responseBody,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': `${contentType}; charset=utf-8`,
        'X-Total-Count': totalConcepts.toString(),
        'X-Page-Number': pageNum.toString(),
        'X-Page-Size': pageSize.toString(),
        'X-Total-Pages': totalPages.toString()
      }
    }
  } catch (error) {
    console.error(`Error retrieving concepts, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    }
  }
}

export default getConcepts
