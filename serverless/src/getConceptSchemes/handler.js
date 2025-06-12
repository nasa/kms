import { XMLBuilder } from 'fast-xml-parser'

import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { logAnalyticsData } from '@/shared/logAnalyticsData'

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
 * curl -X GET https://your-api-endpoint.com/concept_schemes?version=draft
 *
 * // Response:
 * // <?xml version="1.0" encoding="UTF-8"?>
 * // <schemes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd">
 * //   <scheme updateDate="2023-05-15" longName="Science Keywords" name="sciencekeywords" csvHeaders="Category,Topic,Term,Variable Level 1,Variable Level 2,Variable Level 3,Detailed Variable"/>
 * //   <scheme updateDate="2023-05-14" longName="Platforms" name="platforms" csvHeaders="Category,Series_Entity,Short_Name,Long_Name"/>
 * //   <!-- More scheme entries... -->
 * // </schemes>
 *
 * @throws Will throw an error if there's a problem fetching or processing the concept schemes.
 */
export const getConceptSchemes = async (event, context) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event || {}
  const version = queryStringParameters?.version || 'published'

  logAnalyticsData({
    event,
    context
  })

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
