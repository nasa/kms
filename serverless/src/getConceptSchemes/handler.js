import { XMLBuilder } from 'fast-xml-parser'

import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Retrieves and formats concept schemes as XML.
 *
 * This function fetches all concept schemes, formats them into a specific XML structure,
 * and returns the result as a response object suitable for use in a serverless environment.
 *
 * @async
 * @function getConceptSchemes
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - body: The XML string representation of the concept schemes.
 *   - headers: HTTP headers for the response, including Content-Type.
 *   - statusCode: HTTP status code (only present in case of an error).
 * @throws Will throw an error if there's a problem fetching or processing the concept schemes.
 */
export const getConceptSchemes = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()

  try {
    const conceptSchemes = await getConceptSchemeDetails()

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
