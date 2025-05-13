import { sparqlRequest } from './sparqlRequest'

/**
 * Removes a graph from the SPARQL endpoint.
 *
 * This function uses the SPARQL DROP GRAPH operation to remove a specified graph.
 * It's typically used in version management operations, such as cleaning up old versions or resetting the database.
 *
 * @async
 * @function removeGraph
 * @param {Object} params - The parameters for the remove operation.
 * @param {string} params.graphName - The name of the graph to be removed.
 * @throws {Error} If there's an error during the SPARQL request or graph removal process.
 *
 * @example
 * // Remove the 'draft' graph
 * try {
 *   await removeGraph({ graphName: 'draft' });
 *   console.log('Successfully removed the draft graph');
 * } catch (error) {
 *   console.error('Error removing graph:', error);
 * }
 *
 * @example
 * // Remove a specific version graph
 * try {
 *   await removeGraph({ graphName: '9.1.5-draft' });
 *   console.log('Successfully removed the 9.1.5-draft graph');
 * } catch (error) {
 *   console.error('Error removing graph:', error);
 * }
 *
 * @see Related function:
 * {@link sparqlRequest}
 */
export const removeGraph = async (graphName) => {
  const removeQuery = `
    DROP GRAPH <https://gcmd.earthdata.nasa.gov/kms/version/${graphName}>
  `

  try {
    await sparqlRequest({
      method: 'POST',
      body: removeQuery,
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json'
    })

    console.log(`Successfully removed graph: ${graphName}`)
  } catch (error) {
    console.error(`Error removing graph ${graphName}:`, error)
    throw error
  }
}
