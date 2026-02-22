import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Retrieves metadata for a specific version of the concept scheme.
 *
 * This function sends a SPARQL query to fetch metadata about a particular version,
 * including its name, type, creation date, modification date, and last sync date.
 *
 * @async
 * @function getVersionMetadata
 * @param {string} version - The version identifier to retrieve metadata for (e.g., 'published', 'draft', or a specific version number).
 * @returns {Promise<Object|null>} A promise that resolves to an object containing the version metadata, or null if the version is not found.
 * @throws {Error} If there's an error during the SPARQL request or processing of the response.
 *
 * @example
 * // Retrieve metadata for the published version
 * try {
 *   const metadata = await getVersionMetadata('published');
 *   console.log(metadata);
 *   // Example output:
 *   // {
 *   //   version: 'published',
 *   //   versionName: '9.1.5',
 *   //   versionType: 'published',
 *   //   created: '2023-01-15T00:00:00Z',
 *   //   lastSynced: '2023-07-01T10:00:00Z'
 *   // }
 * } catch (error) {
 *   console.error('Failed to retrieve version metadata:', error);
 * }
 *
 * @see Related function:
 * {@link sparqlRequest}
 */
export const getVersionMetadata = async (version) => {
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>

    SELECT ?versionType ?versionName ?created ?lastSynced
    WHERE {
      <${versionUri}> a gcmd:Version ;
                      gcmd:versionName ?versionName ;
                      gcmd:versionType ?versionType ;
                      dcterms:created ?created .
      OPTIONAL { <${versionUri}> gcmd:lastSynced ?lastSynced }
    }
  `

  try {
    const response = await sparqlRequest({
      method: 'POST',
      body: query,
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '8000', 10)
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
      versionName: metadata.versionName.value.toString(),
      versionType: metadata.versionType.value,
      created: metadata.created.value,
      lastSynced: metadata.lastSynced ? metadata.lastSynced.value : null
    }
  } catch (error) {
    console.error('Error retrieving version metadata:', error)
    throw error
  }
}
