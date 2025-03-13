import { XMLBuilder } from 'fast-xml-parser'

import { getApplicationConfig } from '@/shared/getConfig'
import { sparqlRequest } from '@/shared/sparqlRequest'

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
