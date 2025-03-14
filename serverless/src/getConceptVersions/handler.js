import { XMLBuilder } from 'fast-xml-parser'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves and formats concept versions as XML.
 *
 * This function fetches all concept versions or versions of a specific type from the SPARQL endpoint,
 * formats them into a specific XML structure, and returns the result as a response object
 * suitable for use in a serverless environment.
 *
 * @async
 * @function getConceptVersions
 * @param {Object} event - The Lambda event object.
 * @param {Object} event.pathParameters - The path parameters from the API Gateway event.
 * @param {string} [event.pathParameters.versionType='all'] - The type of versions to retrieve ('all' or a specific type).
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for error).
 *   - body: The XML string representation of the concept versions.
 *   - headers: HTTP headers for the response, including Content-Type.
 *
 * @example
 * // Lambda event object for all versions
 * const eventAll = {
 *   pathParameters: { versionType: 'all' }
 * };
 *
 * // Lambda event object for a specific version type
 * const eventSpecific = {
 *   pathParameters: { versionType: 'published' }
 * };
 *
 * const result = await getConceptVersions(eventAll);
 * console.log(result);
 * // Output on success:
 * // {
 * //   statusCode: 200,
 * //   body: `<?xml version="1.0"?>
 * //     <versions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd">
 * //       <version type="published" creation_date="2023-06-15">9.1.5</version>
 * //       <version type="draft" creation_date="2023-06-10">9.1.6-SNAPSHOT</version>
 * //       <version type="past_published" creation_date="2023-05-01">9.1.4</version>
 * //     </versions>`,
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
 * @throws Will throw an error if there's a problem fetching or processing the concept versions.
 */
export const getConceptVersions = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { pathParameters } = event
  const { versionType } = pathParameters

  try {
    // Updated SPARQL query to get graph names and creation dates
    const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT DISTINCT ?graph ?creationDate ?versionType ?versionName
    WHERE {
      GRAPH ?graph {
        ?version a gcmd:Version ;
                 dcterms:created ?creationDate ;
                 gcmd:versionName ?versionName ;
                 gcmd:versionType ?versionType .
        ${versionType && versionType.toLowerCase() !== 'all' ? `FILTER(LCASE(?versionType) = LCASE("${versionType}"))` : ''}
      }
    }
    ORDER BY DESC(?graph)
  `
    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    })

    if (!response.ok) {
      throw new Error(`SPARQL request failed with status ${response.status}`)
    }

    const result = await response.json()
    const graphData = result.results.bindings

    const versions = graphData.map((data) => {
      const creationDate = data.creationDate.value
      const versionName = data.versionName.value
      const vType = data.versionType.value

      let formattedDate = ''
      try {
        const [formattedDatePart] = new Date(creationDate).toISOString().split('T')
        formattedDate = formattedDatePart
      } catch (error) {
        console.warn(`Invalid date format: ${creationDate}`)
      }

      return {
        '@_type': vType,
        '@_creation_date': formattedDate,
        '#text': versionName
      }
    }).filter(Boolean)

    const xmlObj = {
      versions: {
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xsi:noNamespaceSchemaLocation': 'https://gcmd.earthdata.nasa.gov/static/kms/kms.xsd',
        ...(versions.length > 0 ? { version: versions } : {})
      }
    }
    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    })

    const xml = builder.build(xmlObj)

    return {
      statusCode: 200,
      body: xml,
      headers: {
        ...defaultResponseHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
      }
    }
  } catch (error) {
    console.error(`Error retrieving concept versions, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getConceptVersions
