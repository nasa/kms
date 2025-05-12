import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Updates the version metadata for a specific graph in the RDF store.
 *
 * This function constructs and executes a SPARQL UPDATE query to modify the version metadata
 * of a specified graph. It can update the version name, version type, creation date,
 * and last synced date of the version metadata.
 *
 * @async
 * @function updateVersionMetadata
 * @param {Object} options - The options for updating the version metadata.
 * @param {string} options.graphId - The identifier of the graph to update (e.g., 'published', 'draft', or a specific version number).
 * @param {string} [options.version] - The new version name to set.
 * @param {string} [options.versionType] - The new version type to set (e.g., 'published', 'draft').
 * @param {string} [options.createdDate] - The new creation date to set (in ISO 8601 format).
 * @param {string} [options.lastSynced] - The new last synced date to set (in ISO 8601 format).
 * @returns {Promise<Response>} A promise that resolves to the response from the SPARQL endpoint.
 * @throws {Error} If the update operation fails or if there's an error in the SPARQL request.
 *
 * @example
 * // Update the metadata for the published version
 * try {
 *   const response = await updateVersionMetadata({
 *     graphId: 'published',
 *     version: '9.1.5',
 *     versionType: 'published',
 *     createdDate: new Date().toISOString(),
 *     lastSynced: new Date().toISOString()
 *   });
 *   console.log('Version metadata updated successfully');
 * } catch (error) {
 *   console.error('Failed to update version metadata:', error);
 * }
 *
 * @see Related function:
 * {@link sparqlRequest}
 */

export const updateVersionMetadata = async ({
  graphId,
  version,
  versionType,
  createdDate,
  lastSynced,
  transactionUrl
}) => {
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${graphId}`
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'

  let deleteClause = ''
  let insertClause = ''

  if (version !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionName ?oldVersionName .\n`
    insertClause += `<${versionUri}> gcmd:versionName "${version}" .\n`
  }

  if (versionType !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionType ?oldVersionType .\n`
    insertClause += `<${versionUri}> gcmd:versionType "${versionType}" .\n`
  }

  if (createdDate !== undefined) {
    deleteClause += `<${versionUri}> dcterms:created ?oldCreatedDate .\n`
    insertClause += `<${versionUri}> dcterms:created "${createdDate}"^^xsd:dateTime .\n`
  }

  if (lastSynced !== undefined) {
    deleteClause += `<${versionUri}> gcmd:lastSynced ?oldLastSynced .\n`
    insertClause += `<${versionUri}> gcmd:lastSynced "${lastSynced}"^^xsd:dateTime .\n`
  }

  const query = `
    PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
    PREFIX dcterms: <http://purl.org/dc/terms/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    WITH <${graphUri}>
    DELETE {
      ${deleteClause}
    }
    INSERT {
      <${versionUri}> a gcmd:Version .
      ${insertClause}
    }
    WHERE {
      OPTIONAL { ${deleteClause} }
    }
  `

  try {
    const response = await sparqlRequest({
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      },
      method: 'PUT',
      body: query,
      contentType: 'application/sparql-update',
      accept: 'application/json'
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to update version metadata: ${response.status} ${response.statusText}\n${errorText}`)
    }

    return response
  } catch (error) {
    console.error('Error updating version metadata:', error)
    throw error
  }
}
