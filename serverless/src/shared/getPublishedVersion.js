import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves the currently published version by searching through all graphs
 * @returns {Promise<string|null>} - The version name of the published version, or null if not found
 */
export const getPublishedVersion = async () => {
  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms/gcmd/>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?version ?graph
    WHERE {
      GRAPH ?graph {
        ?versionUri a gcmd:Version ;
                    gcmd:versionType "published" .
      }
    }
    LIMIT 1
  `

  try {
    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to retrieve published version: ${response.status} ${response.statusText}\n${errorText}`)
    }

    const result = await response.json()
    const { bindings } = result.results

    if (bindings.length > 0 && bindings[0].version) {
      console.log(`Published version found in graph: ${bindings[0].graph.value}`)

      return bindings[0].version.value
    }

    console.log('No published version found in any graph')

    return null
  } catch (error) {
    console.error('Error retrieving published version:', error)
    throw error
  }
}
