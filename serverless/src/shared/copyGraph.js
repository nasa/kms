import { sparqlRequest } from './sparqlRequest'

/**
 * Copies a named graph from one graph to another in the SPARQL endpoint.
 *
 * This function uses the SPARQL COPY operation to duplicate all triples
 * from the source graph to the target graph. It's typically used in version
 * management operations, such as creating a new published version from a draft.
 *
 * @async
 * @function copyGraph
 * @param {Object} params - The parameters for the copy operation.
 * @param {string} params.sourceGraphName - The name of the source graph to copy from.
 * @param {string} params.targetGraphName - The name of the target graph to copy to.
 * @throws {Error} If there's an error during the SPARQL request or graph copying process.
 *
 * @example
 * // Copy the 'draft' graph to a new 'published' graph
 * try {
 *   await copyGraph({ sourceGraphName: 'draft', targetGraphName: 'published' });
 *   console.log('Successfully copied draft to published');
 * } catch (error) {
 *   console.error('Error copying graph:', error);
 * }
 *
 * @example
 * // Create a backup of the 'published' graph
 * try {
 *   await copyGraph({ sourceGraphName: 'published', targetGraphName: 'backup_20230615' });
 *   console.log('Successfully created backup of published graph');
 * } catch (error) {
 *   console.error('Error creating backup:', error);
 * }
 *
 * @see Related function {@link sparqlRequest} for the underlying SPARQL request mechanism.
 */
export const copyGraph = async ({ sourceGraphName, targetGraphName }) => {
  const copyQuery = `
    COPY <https://gcmd.earthdata.nasa.gov/kms/version/${sourceGraphName}>
    TO <https://gcmd.earthdata.nasa.gov/kms/version/${targetGraphName}>
  `

  try {
    await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: copyQuery,
      contentType: 'application/sparql-update'
    })

    console.log(`Successfully copied graph from ${sourceGraphName} to ${targetGraphName}`)
  } catch (error) {
    console.error(`Error copying graph from ${sourceGraphName} to ${targetGraphName}:`, error)
    throw error
  }
}
