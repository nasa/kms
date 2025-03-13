import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves metadata for a specific version
 * @param {string} version - The version number to retrieve
 * @returns {Promise<Object>} - The version metadata
 */
export const getVersionMetadata = async (version) => {
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?versionType ?versionName ?created ?modified
    WHERE {
      <${versionUri}> a gcmd:Version ;
                      gcmd:versionName ?versionName ;
                      gcmd:versionType ?versionType ;
                      dcterms:created ?created ;
                      dcterms:modified ?modified .
    }
  `

  try {
    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to retrieve version metadata: ${response.status} ${response.statusText}\n${errorText}`)
    }

    const result = await response.json()

    if (result.results.bindings.length === 0) {
      return null // Version not found
    }

    const metadata = result.results.bindings[0]

    return {
      version,
      versionName: metadata.versionName.value,
      versionType: metadata.versionType.value,
      created: metadata.created.value,
      modified: metadata.modified.value
    }
  } catch (error) {
    console.error('Error retrieving version metadata:', error)
    throw error
  }
}
