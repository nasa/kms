import { XMLBuilder } from 'fast-xml-parser'

import { namespaces } from '@/shared/constants/namespaces'
import { createConceptSchemeMap } from '@/shared/createConceptSchemeMap'
import { createPrefLabelMap } from '@/shared/createPrefLabelMap'
import { getApplicationConfig } from '@/shared/getConfig'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'
import toLegacyJSON from '@/shared/toLegacyJSON'

/**
 * Retrieves a SKOS Concept and returns it as RDF/XML.
 *
 * This function fetches a SKOS concept from the RDF store using one of the following:
 * - Concept ID
 * - Short Name
 * - Alt Label
 * It then constructs an RDF/XML representation of the concept and returns it in the response.
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
 * @returns {Promise<Object>} A promise that resolves to an object containing the statusCode, body, and headers.
 *
 * @example
 * // Lambda event object for concept ID
 * const eventConceptId = {
 *   pathParameters: { conceptId: '123' }
 * };
 *
 * // Lambda event object for short name
 * const eventShortName = {
 *   pathParameters: { shortName: 'Earth Science' },
 *   queryStringParameters: { scheme: 'sciencekeywords' }
 * };
 *
 * // Lambda event object for alt label
 * const eventAltLabel = {
 *   pathParameters: { altLabel: 'ES' },
 *   queryStringParameters: { scheme: 'sciencekeywords' }
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
 *
 * @throws {Error} If there's an error retrieving or processing the concept.
 */
export const getConcept = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId, shortName, altLabel } = pathParameters
  const { queryStringParameters } = event
  const { scheme, format = 'rdf' } = queryStringParameters || {}

  try {
    const decode = (str) => {
      if (!str) return null

      return decodeURIComponent(str.replace(/\+/g, ' '))
    }

    const concept = await getSkosConcept({
      conceptIRI: conceptId ? `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}` : null,
      shortName: shortName ? decode(shortName) : null,
      altLabel: altLabel ? decode(altLabel) : null,
      scheme: scheme ? decode(scheme) : null
    })

    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${concept['@rdf:about']}`

    let responseBody
    let contentType

    // Create a different responseBody based on format recieved from queryStringParameters (defaults to 'rdf)
    if (format.toLowerCase() === 'json') {
      const conceptSchemeMap = await createConceptSchemeMap()
      const prefLabelMap = await createPrefLabelMap()
      responseBody = JSON.stringify(await toLegacyJSON(concept, conceptSchemeMap, prefLabelMap))
      contentType = 'application/json'
    } else if (format.toLowerCase() === 'xml') {
      // TODO in KMS-535
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
          'gcmd:gcmd': await getGcmdMetadata({ conceptIRI }),
          'skos:Concept': [concept]
        }
      }
      responseBody = await builder.build(rdfJson)
      contentType = 'application/rdf+xml'
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
