import { XMLBuilder } from 'fast-xml-parser'

import { buildFullPath } from '@/shared/buildFullPath'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

/**
 * Fetches the full hierarchical path to a concept and returns it as XML.
 *
 * This function is designed to be used as an AWS Lambda handler. It takes a concept ID
 * from the path parameters and a version from the query parameters of the incoming request,
 * builds the full path for that concept, and returns the result as an XML document.
 *
 * @async
 * @function getFullPath
 * @param {Object} event - The AWS Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the HTTP request.
 * @param {string} event.pathParameters.conceptId - The ID of the concept to fetch the path for.
 * @param {Object} event.queryStringParameters - The query string parameters from the HTTP request.
 * @param {string} [event.queryStringParameters.version='published'] - The version of the concept to use.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   @property {number} [statusCode] - HTTP status code (500 for error, omitted for success).
 *   @property {Object} headers - Response headers, including 'Content-Type'.
 *   @property {string} body - The response body:
 *     - For successful requests: XML string containing the full path.
 *     - For errors: JSON string with error information.
 *
 * @throws Will not throw errors directly, but will catch and return them in the response object.
 * @example
 * curl -X GET https://your-api-endpoint.com/concept_fullpaths/concept_uuid/e610b940-2fda-4e1f-88eb-1b2b7bd23e7d?version=draft
 *
 * // Response:
 * // <?xml version="1.0" encoding="UTF-8"?>
 * // <FullPaths>
 * //   <FullPath xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 * //             xmlns:xs="http://www.w3.org/2001/XMLSchema"
 * //             xsi:type="xs:string">
 * //     EARTH SCIENCE|ATMOSPHERE|AEROSOLS
 * //   </FullPath>
 * // </FullPaths>
 *
 * @see Related function {@link buildFullPath} for details on path construction.
 */
export const getFullPath = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { conceptId } = pathParameters
  const { queryStringParameters } = event
  const version = queryStringParameters?.version || 'published'

  logAnalyticsData({
    event,
    context
  })

  try {
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    const fullPathJson = {
      FullPaths: {
        FullPath: {
          '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@xmlns:xs': 'http://www.w3.org/2001/XMLSchema',
          '@xsi:type': 'xs:string',
          _text: await buildFullPath(conceptId, version)
        }
      }
    }
    const xml = await builder.build(fullPathJson)

    return {
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml'
      },
      body: xml
    }
  } catch (error) {
    console.error(`Error retrieving full path, error=${error.toString()}`)

    return {
      statusCode: 500,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getFullPath
