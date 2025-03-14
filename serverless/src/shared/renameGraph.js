import { sparqlRequest } from './sparqlRequest'

/**
 * Renames a graph in the SPARQL endpoint.
 *
 * This function uses the SPARQL MOVE operation to rename a graph from the old name to the new name.
 * It's typically used in version management operations, such as archiving a published version.
 *
 * @async
 * @function renameGraph
 * @param {Object} params - The parameters for the rename operation.
 * @param {string} params.oldGraphName - The current name of the graph to be renamed.
 * @param {string} params.newGraphName - The new name to assign to the graph.
 * @throws {Error} If there's an error during the SPARQL request or graph renaming process.
 *
 * @example
 * // Rename the 'published' graph to '9.1.5'
 * try {
 *   await renameGraph({ oldGraphName: 'published', newGraphName: '9.1.5' });
 *   console.log('Successfully renamed graph from published to 9.1.5');
 * } catch (error) {
 *   console.error('Error renaming graph:', error);
 * }
 *
 * @example
 * // Rename a specific version graph
 * try {
 *   await renameGraph({ oldGraphName: '9.1.5-draft', newGraphName: '9.1.5' });
 *   console.log('Successfully renamed graph from 9.1.5-draft to 9.1.5');
 * } catch (error) {
 *   console.error('Error renaming graph:', error);
 * }
 *
 * @see Related function:
 * {@link sparqlRequest}
 */
export const renameGraph = async ({ oldGraphName, newGraphName }) => {
  const renameQuery = `
    MOVE <https://gcmd.earthdata.nasa.gov/kms/version/${oldGraphName}>
    TO <https://gcmd.earthdata.nasa.gov/kms/version/${newGraphName}>
  `

  try {
    await sparqlRequest({
      path: '/statements',
      method: 'POST',
      body: renameQuery,
      contentType: 'application/sparql-update'
    })

    console.log(`Successfully renamed graph from ${oldGraphName} to ${newGraphName}`)
  } catch (error) {
    console.error(`Error renaming graph from ${oldGraphName} to ${newGraphName}:`, error)
    throw error
  }
}
