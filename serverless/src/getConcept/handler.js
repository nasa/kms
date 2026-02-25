import { XMLBuilder } from 'fast-xml-parser'

import {
  createConceptResponseCacheKey,
  getCachedConceptResponse,
  setCachedConceptResponse
} from '@/shared/conceptResponseCache'
import { namespaces } from '@/shared/constants/namespaces'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import {
  createConceptToConceptSchemeShortNameMap
} from '@/shared/createConceptToConceptSchemeShortNameMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getCsvHeaders } from '@/shared/getCsvHeaders'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { logAnalyticsData } from '@/shared/logAnalyticsData'
import { logger } from '@/shared/logger'
import { toLegacyJSON } from '@/shared/toLegacyJSON'
import { toLegacyXML } from '@/shared/toLegacyXML'

/**
 * Retrieves a SKOS Concept and returns it in the specified format.
 *
 * This function fetches a SKOS concept from the RDF store using one of the following:
 * - Concept ID
 * - Short Name
 * - Alt Label
 * It then constructs a representation of the concept in the requested format and returns it in the response.
 *
 * @async
 * @function getConcept
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} [event.pathParameters.conceptId] - The ID of the concept to retrieve.
 * @param {string} [event.pathParameters.shortName] - The short name of the concept to retrieve.
 * @param {string} [event.pathParameters.altLabel] - The alt label of the concept to retrieve.
 * @param {Object} [event.queryStringParameters] - The query string parameters from the API Gateway event.
 * @param {string} [event.queryStringParameters.scheme] - The scheme to filter the concept search.
 * @param {string} [event.queryStringParameters.format='rdf'] - The format of the response (rdf, json, or xml).
 * @param {string} [event.queryStringParameters.version='published'] - The version of the concept to retrieve (default is 'published').
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object for concept ID
 * const eventConceptId = {
 *   pathParameters: { conceptId: '123' },
 *   queryStringParameters: { version: 'published', format: 'rdf' }
 * };
 *
 * // Lambda event object for short name
 * const eventShortName = {
 *   pathParameters: { shortName: 'Earth Science' },
 *   queryStringParameters: { scheme: 'sciencekeywords', version: 'draft', format: 'json' }
 * };
 *
 * // Lambda event object for alt label
 * const eventAltLabel = {
 *   pathParameters: { altLabel: 'ES' },
 *   queryStringParameters: { scheme: 'sciencekeywords', version: 'published', format: 'xml' }
 * };
 *
 * const result = await getConcept(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: '...', // Content depends on the requested format
 * //   headers: { ... }
 * // }
 *
 * @throws {Error} If there's an error retrieving or processing the concept.
 */
export const getConcept = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const {
    conceptId, shortName, altLabel, fullPath
  } = pathParameters || {}
  const { queryStringParameters } = event
  const { scheme, format = 'rdf' } = queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'

  logAnalyticsData({
    event,
    context
  })

  try {
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

    const decode = (str) => {
      if (!str) return null

      return decodeURIComponent(str.replace(/\+/g, ' '))
    }

    const decodedConceptId = conceptId ? decode(conceptId) : null
    const decodedShortName = shortName ? decode(shortName) : null
    const decodedAltLabel = altLabel ? decode(altLabel) : null
    const decodedFullPath = fullPath ? decode(fullPath) : null
    const decodedScheme = scheme ? decode(scheme) : null

    const conceptCacheKey = createConceptResponseCacheKey({
      version,
      path: event?.resource || event?.path,
      endpointPath: event?.path,
      format,
      conceptId: decodedConceptId,
      shortName: decodedShortName,
      altLabel: decodedAltLabel,
      fullPath: decodedFullPath,
      scheme: decodedScheme
    })

    try {
      const cachedResponse = await getCachedConceptResponse(conceptCacheKey)
      if (cachedResponse) {
        logger.info(`[cache] hit endpoint=getConcept key=${conceptCacheKey}`)

        return cachedResponse
      }

      logger.info(`[cache] miss endpoint=getConcept key=${conceptCacheKey}`)
    } catch (cacheReadError) {
      logger.error(`Redis concept cache read error key=${conceptCacheKey}, error=${cacheReadError}`)
    }

    const concept = await getSkosConcept({
      conceptIRI: decodedConceptId ? `https://gcmd.earthdata.nasa.gov/kms/concept/${decodedConceptId}` : null,
      shortName: decodedShortName,
      altLabel: decodedAltLabel,
      fullPath: decodedFullPath,
      scheme: decodedScheme,
      version
    })

    // Check if concept is null and return 404 if so
    if (concept === null) {
      return {
        statusCode: 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Concept not found'
        })
      }
    }

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${concept['@rdf:about']}`
    const prefLabelMap = await createPrefLabelMap(version)

    let responseBody
    let contentType

    // Create a different responseBody based on format recieved from queryStringParameters (defaults to 'rdf)
    if (format.toLowerCase() === 'json') {
      const conceptSchemeMap = await createConceptSchemeMap(event)
      // eslint-disable-next-line max-len
      const conceptToConceptSchemeShortNameMap = await createConceptToConceptSchemeShortNameMap(version)
      responseBody = JSON.stringify(toLegacyJSON(
        concept,
        conceptSchemeMap,
        conceptToConceptSchemeShortNameMap,
        prefLabelMap,
        keywordVersion,
        versionCreationDate
      ), null, 2)

      contentType = 'application/json'
    } else if (format.toLowerCase() === 'xml') {
      const xmlBuilder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        indentBy: '  ',
        attributeNamePrefix: '@',
        suppressEmptyNode: true
      })
      const schemeResource = concept['skos:inScheme']['@rdf:resource']
      const schemeShortName = schemeResource.split('/').pop()
      const csvHeaders = await getCsvHeaders(schemeShortName)
      const conceptSchemeDetails = await getConceptSchemeDetails({ version })
      // eslint-disable-next-line max-len
      const conceptToConceptSchemeShortNameMap = await createConceptToConceptSchemeShortNameMap(version)
      const legacyXML = toLegacyXML(
        concept,
        conceptSchemeDetails,
        csvHeaders,
        conceptToConceptSchemeShortNameMap,
        prefLabelMap,
        schemeShortName,
        keywordVersion,
        versionCreationDate
      )
      responseBody = xmlBuilder.build(legacyXML)
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
      const rdfJson = {
        'rdf:RDF': {
          ...namespaces,
          '@xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
          'gcmd:gcmd': await getGcmdMetadata({
            conceptIRI,
            version
          }),
          'skos:Concept': [concept]
        }
      }
      responseBody = await builder.build(rdfJson)
      contentType = 'application/xml'
    }

    const response = {
      statusCode: 200,
      body: responseBody,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': `${contentType}; charset=utf-8`
      }
    }

    if (response.statusCode === 200) {
      try {
        logger.debug(`[cache] write endpoint=getConcept key=${conceptCacheKey}`)
        await setCachedConceptResponse({
          cacheKey: conceptCacheKey,
          response
        })
      } catch (cacheWriteError) {
        logger.error(`Redis concept cache write error key=${conceptCacheKey}, error=${cacheWriteError}`)
      }
    }

    return response
  } catch (error) {
    logger.error(`Error retrieving concept, error=${error.toString()}`)

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
