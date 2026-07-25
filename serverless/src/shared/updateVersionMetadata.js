import { escapeSparqlString } from '@/shared/escapeSparqlString'
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
 * @param {string} options.transactionUrl - The URL for the SPARQL transaction.
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
 *     lastSynced: new Date().toISOString(),
 *     transactionUrl: 'http://example.com/sparql/transaction'
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
  const graphUri = `https://gcmd.earthdata.nasa.gov/kms/version/${escapeSparqlString(graphId)}`
  const versionUri = 'https://gcmd.earthdata.nasa.gov/kms/version_metadata'

  // Sanitize text-based parameters using escapeSparqlString
  const safeVersion = version !== undefined ? escapeSparqlString(version) : undefined
  const safeVersionType = versionType !== undefined ? escapeSparqlString(versionType) : undefined

  // Ensure dates are valid ISO strings to prevent xsd:dateTime parsing errors in the triple store
  const safeCreatedDate = createdDate !== undefined
    ? escapeSparqlString(createdDate)
    : undefined

  const safeLastSynced = lastSynced !== undefined
    ? escapeSparqlString(lastSynced)
    : undefined

  let deleteClause = ''
  let insertClause = ''

  if (version !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionName ?oldVersionName .\n`
    insertClause += `<${versionUri}> gcmd:versionName "${safeVersion}" .\n`
  }

  if (versionType !== undefined) {
    deleteClause += `<${versionUri}> gcmd:versionType ?oldVersionType .\n`
    insertClause += `<${versionUri}> gcmd:versionType "${safeVersionType}" .\n`
  }

  if (createdDate !== undefined) {
    deleteClause += `<${versionUri}> dcterms:created ?oldCreatedDate .\n`
    insertClause += `<${versionUri}> dcterms:created "${safeCreatedDate}"^^xsd:dateTime .\n`
  }

  if (lastSynced !== undefined) {
    deleteClause += `<${versionUri}> gcmd:lastSynced ?oldLastSynced .\n`
    insertClause += `<${versionUri}> gcmd:lastSynced "${safeLastSynced}"^^xsd:dateTime .\n`
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
      method: 'PUT',
      contentType: 'application/sparql-update',
      accept: 'application/json',
      body: query,
      transaction: {
        transactionUrl,
        action: 'UPDATE'
      }
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
