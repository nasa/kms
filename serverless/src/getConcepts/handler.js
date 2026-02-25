/* eslint-disable no-underscore-dangle */
import { promisify } from 'util'
import zlib from 'zlib'

import { XMLBuilder } from 'fast-xml-parser'

import {
  createConceptsResponseCacheKey,
  getCachedConceptsResponse,
  setCachedConceptsResponse
} from '@/shared/conceptsResponseCache'
import { namespaces } from '@/shared/constants/namespaces'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import {
  createConceptToConceptSchemeShortNameMap
} from '@/shared/createConceptToConceptSchemeShortNameMap'
import { createCsvForScheme } from '@/shared/createCsvForScheme'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getFilteredTriples } from '@/shared/getFilteredTriples'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getRootConcepts } from '@/shared/getRootConcepts'
import { getTotalConceptCount } from '@/shared/getTotalConceptCount'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { processTriples } from '@/shared/processTriples'
import { toLegacyJSON } from '@/shared/toLegacyJSON'
import { toSkosJson } from '@/shared/toSkosJson'

/**
 * Retrieves multiple SKOS Concepts and returns them in the specified format.
 *
 * This function fetches SKOS concepts from the RDF store based on the provided parameters,
 * processes them, and constructs a representation of the concepts in the requested format.
 * It supports pagination, various output formats, and performance tracking.
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
 * @param {string} [event.path] - The path of the API request.
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
 *
 * @description
 * This function performs the following main operations:
 * 1. Validates and processes input parameters.
 * 2. Retrieves concepts based on the provided filters and pagination.
 * 3. Processes the retrieved triples into a structured format.
 * 4. Generates the response in the requested format (RDF, JSON, XML, or CSV).
 * 5. Tracks performance metrics for various operations.
 *
 * Supported formats:
 * - RDF (default): Returns concepts in RDF/XML format.
 * - JSON: Returns a JSON object with concept details and metadata.
 * - XML: Returns an XML representation of concepts.
 * - CSV: Returns concepts in CSV format (requires conceptScheme parameter).
 *
 * Note: The CSV format has specific requirements and restrictions.
 */

export const getConcepts = async (event, context) => {
  const startTime = performance.now()
  const performanceMetrics = {}

  const { defaultResponseHeaders, maxTotalConceptsLimit = 50000 } = getApplicationConfig()
  const { queryStringParameters } = event
  const { pattern } = event?.pathParameters || {}
  let { conceptScheme } = event?.pathParameters || {}
  const { page_num: pageNumStr = '1', page_size: pageSizeStr = '2000', format = 'rdf' } = event?.queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'

  // Check existence of version
  let keywordVersion = 'n/a'
  let versionCreationDate = 'n/a'
  const versionInfo = await getVersionMetadata(version)
  if (versionInfo) {
    keywordVersion = versionInfo.versionName
    versionCreationDate = versionInfo.created
  } else {
    return {
      headers: defaultResponseHeaders,
      statusCode: 404,
      body: JSON.stringify({ error: 'Invalid version parameter. Version not found' })
    }
  }

  // Check existence of scheme if given
  if (conceptScheme) {
    if (conceptScheme.toLowerCase() === 'granuledataformat') {
      conceptScheme = 'dataformat'
    }

    const scheme = await getConceptSchemeDetails({
      schemeName: conceptScheme,
      version
    })
    if (scheme === null) {
      return {
        headers: defaultResponseHeaders,
        statusCode: 404,
        body: JSON.stringify({ error: 'Invalid concept scheme parameter. Concept scheme not found' })
      }
    }
  }

  // Convert page_num and page_size to integers
  const pageNum = parseInt(pageNumStr, 10)
  const pageSize = parseInt(pageSizeStr, 10)

  logAnalyticsData({
    event,
    context,
    search: pattern
  })

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

  // Discourage inefficient API usage patterns, such as aggressive looping through pages
  // which results in costs associated with calculating total count for each request.
  if (pageSize * pageNum > maxTotalConceptsLimit) {
    return {
      headers: defaultResponseHeaders,
      statusCode: 400,
      body: JSON.stringify({
        error: `Invalid page_size/page_num parameters (${pageSize * pageNum}) exceeds the maximum allowed (${maxTotalConceptsLimit}).`
      })
    }
  }

  try {
    const cacheKey = createConceptsResponseCacheKey({
      version,
      path: event?.resource || event?.path,
      endpointPath: event?.path,
      conceptScheme,
      pattern,
      pageNum,
      pageSize,
      format
    })

    try {
      const cachedResponse = await getCachedConceptsResponse(cacheKey)
      if (cachedResponse) {
        console.log(`[cache] hit endpoint=getConcepts format=${format.toLowerCase()} key=${cacheKey}`)
        if (format.toLowerCase() === 'csv') {
          console.log(`[cache] csv hit endpoint=getConcepts key=${cacheKey}`)
        }

        return cachedResponse
      }

      console.log(`[cache] miss endpoint=getConcepts format=${format.toLowerCase()} key=${cacheKey}`)
      if (format.toLowerCase() === 'csv') {
        console.log(`[cache] csv miss endpoint=getConcepts key=${cacheKey}`)
      }
    } catch (cacheReadError) {
      console.error(`Redis cache read error key=${cacheKey}, error=${cacheReadError}`)
    }

    // CSV case
    if (format.toLowerCase() === 'csv') {
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

      const csvResponse = await createCsvForScheme({
        scheme: conceptScheme,
        version,
        versionName: keywordVersion,
        versionCreationDate
      })

      if (csvResponse.statusCode === 200) {
        try {
          console.log(`[cache] csv write endpoint=getConcepts key=${cacheKey}`)
          await setCachedConceptsResponse({
            cacheKey,
            response: csvResponse
          })
        } catch (cacheWriteError) {
          console.error(`Redis cache write error key=${cacheKey}, error=${cacheWriteError}`)
        }
      } else {
        console.log(`[cache] csv skip-write endpoint=getConcepts status=${csvResponse.statusCode} key=${cacheKey}`)
      }

      return csvResponse
    }

    let triples
    if (event?.path === '/concepts/root') {
      triples = await getRootConcepts(version)
    } else {
      const start = performance.now()
      triples = await getFilteredTriples({
        conceptScheme,
        pattern,
        version,
        pageNum,
        pageSize
      })

      const end = performance.now()
      performanceMetrics.dbFetch = (end - start).toFixed(2)
    }

    let start = performance.now()
    const { bNodeMap, nodes, conceptURIs } = processTriples(triples)
    let end = performance.now()
    performanceMetrics.processFetch = (end - start).toFixed(2)

    start = performance.now()
    const totalConcepts = await getTotalConceptCount({
      conceptScheme,
      pattern,
      version
    })
    end = performance.now()
    performanceMetrics.fetchTotalCount = (end - start).toFixed(2)

    const totalPages = Math.ceil(totalConcepts / pageSize)

    let responseBody
    let contentType

    // Handle different formats based on queryStringParameter 'format'
    if (format.toLowerCase() === 'json') {
      const prefLabelMap = await createPrefLabelMap(version)
      const conceptToConceptSchemeShortNameMap = await
      createConceptToConceptSchemeShortNameMap(version)

      const conceptSchemeMap = await createConceptSchemeMap(event)

      const jsonResponse = {
        hits: totalConcepts,
        page_num: pageNum,
        page_size: pageSize,
        termsOfUse: 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
        keywordVersion,
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
    } else if (format.toLowerCase() === 'xml') {
      const conceptToConceptSchemeShortNameMap = await
      createConceptToConceptSchemeShortNameMap(version)

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
          keywordVersion,
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
      start = performance.now()

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
      end = performance.now()
      performanceMetrics.buildXml = (end - start).toFixed(2)
    }

    const endTime = performance.now()
    performanceMetrics.totalTime = (endTime - startTime).toFixed(2)
    console.log('get concepts performance=', JSON.stringify(performanceMetrics))

    // API Gateway has a hard limit of responses at 6MB
    const SIZE_THRESHOLD = 5 * 1024 * 1024 // Set threshold to 5MB to have some buffer
    const contentSize = Buffer.byteLength(responseBody)

    const headers = {
      ...defaultResponseHeaders,
      'Content-Type': `${contentType}; charset=utf-8`,
      'X-Total-Count': totalConcepts.toString(),
      'X-Page-Number': pageNum.toString(),
      'X-Page-Size': pageSize.toString(),
      'X-Total-Pages': totalPages.toString()
    }
    let response
    const isSamLocal = process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_OFFLINE === 'true'
    // Check if the response body size exceeds the threshold for compression
    if (contentSize < SIZE_THRESHOLD || isSamLocal) {
      // If the content is smaller than the threshold, return uncompressed
      response = {
        statusCode: 200,
        body: responseBody,
        headers
      }
    } else {
      // If the content is larger than the threshold, attempt to compress it
      const gzip = promisify(zlib.gzip)
      try {
        const compressedBody = await gzip(responseBody)
        response = {
          statusCode: 200,
          body: compressedBody.toString('base64'),
          isBase64Encoded: true,
          headers: {
            ...headers,
            'Content-Encoding': 'gzip',
            'Content-Length': compressedBody.length
          }
        }
      } catch (compressionError) {
        // Log the error if compression fails
        console.error('Error compressing response:', compressionError)
        // Fallback to uncompressed response if compression fails
        response = {
          statusCode: 200,
          body: responseBody,
          headers
        }
      }
    }

    if (response.statusCode === 200) {
      try {
        console.log(`[cache] write endpoint=getConcepts key=${cacheKey}`)
        await setCachedConceptsResponse({
          cacheKey,
          response
        })
      } catch (cacheWriteError) {
        console.error(`Redis cache write error key=${cacheKey}, error=${cacheWriteError}`)
      }
    }

    return response
  } catch (error) {
    console.error(`Error retrieving concepts, error=${error}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({ error: error.toString() })
    }
  }
}

export default getConcepts
