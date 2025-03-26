import { XMLBuilder } from 'fast-xml-parser'

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
export const getConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId, shortName, altLabel } = pathParameters
  const { queryStringParameters } = event
  const { scheme, format = 'rdf' } = queryStringParameters || {}
  const version = queryStringParameters?.version || 'published'

  try {
    const decode = (str) => {
      if (!str) return null

      return decodeURIComponent(str.replace(/\+/g, ' '))
    }

    const concept = await getSkosConcept({
      conceptIRI: conceptId ? `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}` : null,
      shortName: shortName ? decode(shortName) : null,
      altLabel: altLabel ? decode(altLabel) : null,
      scheme: scheme ? decode(scheme) : null,
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
        prefLabelMap
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
        schemeShortName
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

    return {
      statusCode: 200,
      body: responseBody,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': `${contentType}; charset=utf-8`
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
