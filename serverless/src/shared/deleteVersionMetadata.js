import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Deletes a gcmd:Version and all its properties
 * @param {string} version - The version number to delete
 * @returns {Promise<Object>} - The response from the SPARQL endpoint
 */
export const deleteVersionMetadata = async (version) => {
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'
  console.log('Deleting version:', versionUri)

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>

    DELETE {
        <${versionUri}> ?p ?o .
    }
    WHERE {
        <${versionUri}> ?p ?o .
    }
  `

  try {
    const response = await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: query,
      contentType: 'application/sparql-update',
      accept: 'application/json',
      version
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to delete version metadata: ${response.status} ${response.statusText}\n${errorText}`)
    }

    return response
  } catch (error) {
    console.error('Error deleting version metadata:', error)
    throw error
  }
}
