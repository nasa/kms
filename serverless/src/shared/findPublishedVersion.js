// Add this to your imports
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Finds the currently published version
 * @returns {Promise<string|null>} The URI of the published graph, or null if not found
 */
export const findPublishedVersion = async () => {
  const findPublishedQuery = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    SELECT ?graph WHERE {
      GRAPH ?graph {
        ?version a gcmd:Version ;
                 gcmd:versionType "published" .
      }
    }
  `

  try {
    const findPublishedResponse = await sparqlRequest({
      method: 'POST',
      body: findPublishedQuery,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json'
    })

    if (!findPublishedResponse.ok) {
      throw new Error(`Failed to find published version: ${findPublishedResponse.status} ${findPublishedResponse.statusText}`)
    }

    const findPublishedResult = await findPublishedResponse.json()

    return findPublishedResult.results.bindings[0]?.graph.value || null
  } catch (error) {
    console.error('Error finding published version:', error)
    throw error
  }
}
