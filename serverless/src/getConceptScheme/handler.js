import { XMLBuilder } from 'fast-xml-parser'

import { namespaces } from '@/shared/constants/namespaces'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'

/**
 * Retrieves and formats concept scheme details as XML.
 *
 * @param {Object} event - The AWS Lambda event object.
 * @param {Object} event.pathParameters - Path parameters from the request.
 * @param {string} event.pathParameters.schemeId - The ID of the concept scheme.
 * @param {Object} event.queryStringParameters - Query string parameters from the request.
 * @param {string} [event.queryStringParameters.version='published'] - The version of the concept scheme.
 *
 * @returns {Object} The HTTP response object.
 *
 * @example
 * // Example event object
 * const event = {
 *   pathParameters: { schemeId: 'science-keywords' },
 *   queryStringParameters: { version: '8.0' }
 * };
 *
 * // Usage
 * const response = await getConceptScheme(event);
 * // response will contain the XML representation of the concept scheme
 */
export const getConceptScheme = async (event) => {
  // Get default response headers from application config
  const { defaultResponseHeaders } = getApplicationConfig()

  // Extract path and query parameters from the event
  const { pathParameters } = event
  const { schemeId } = pathParameters
  const { queryStringParameters } = event
  const version = queryStringParameters?.version || 'published'

  try {
    // Fetch concept scheme details
    const scheme = await getConceptSchemeDetails({
      schemeName: schemeId,
      version
    })

    // If scheme is not found, return a 404 response
    if (scheme === null) {
      return {
        statusCode: 404,
        headers: {
          ...defaultResponseHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Scheme not found'
        })
      }
    }

    // Configure XML builder
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    // Get version metadata
    const versionInfo = await getVersionMetadata(version)

    // Construct RDF JSON object
    const rdfJson = {
      'rdf:RDF': {
        ...namespaces,
        'gcmd:Version': {
          'gcmd:versionName': versionInfo.versionName,
          'gcmd:versionType': versionInfo.versionType,
          'dcterms:created': versionInfo.created,
          ...(versionInfo.lastSynced && { 'dcterms:modified': versionInfo.lastSynced })
        },
        'skos:ConceptScheme': {
          '@rdf:about': scheme.uri,
          'skos:prefLabel': scheme.prefLabel,
          'skos:notation': scheme.notation,
          'dcterms:modified': scheme.modified,
          ...(scheme.created && { 'dcterms:created': scheme.created }),
          ...(scheme.csvHeaders && { 'gcmd:csvHeaders': scheme.csvHeaders })
        }
      }
    }

    // Build XML from RDF JSON
    const responseBody = await builder.build(rdfJson)
    const contentType = 'application/xml'

    // Return successful response with XML body
    return {
      statusCode: 200,
      body: responseBody,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': `${contentType}; charset=utf-8`
      }
    }
  } catch (error) {
    // Log and return error response if an exception occurs
    console.error(`Error retrieving concept scheme, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getConceptScheme
