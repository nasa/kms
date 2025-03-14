import { XMLBuilder } from 'fast-xml-parser'

import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Retrieves and formats concept schemes as XML.
 *
 * This function fetches all concept schemes for a specified version, formats them into a specific XML structure,
 * and returns the result as a response object suitable for use in a serverless environment.
 *
 * @async
 * @function getConceptSchemes
 * @param {Object} event - The Lambda event object.
 * @param {Object} [event.queryStringParameters] - The query string parameters from the API Gateway event.
 * @param {string} [event.queryStringParameters.version='published'] - The version of the concept schemes to retrieve.
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - body: The XML string representation of the concept schemes.
 *   - headers: HTTP headers for the response, including Content-Type.
 *   - statusCode: HTTP status code (200 for success, 500 for error).
 *
 * @example
 * // Lambda event object
 * const event = {
 *   queryStringParameters: { version: 'draft' }
 * };
 *
 * const result = await getConceptSchemes(event);
 * console.log(result);
 * // Output on success:
 * // {
 * //   body: '<?xml version="1.0"?>...',
 * //   headers: {
 * //     'Content-Type': 'application/xml; charset=utf-8',
 * //     ...
 * //   }
 * // }
 *
 * // Output on error:
 * // {
 * //   statusCode: 500,
 * //   body: '{"error": "Error message"}',
 * //   headers: { ... }
 * // }
 *
 * @throws Will throw an error if there's a problem fetching or processing the concept schemes.
 */
export const getConceptSchemes = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'published'

  try {
    const conceptSchemes = await getConceptSchemeDetails({ version })

    const schemes = {
      schemes: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:noNamespaceSchemaLocation': 'https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd',
        scheme: conceptSchemes.map((scheme) => ({
          '@_updateDate': scheme.modified,
          '@_longName': scheme.prefLabel,
          '@_name': scheme.notation,
          ...(scheme.csvHeaders ? { '@_csvHeaders': scheme.csvHeaders } : {})
        }))
      }
    }

    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      suppressEmptyNode: true,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    })

    const xml = builder.build(schemes)

    return {
      body: xml,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
      }
    }
  } catch (error) {
    console.error(`Error retrieving concept schemes, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getConceptSchemes
