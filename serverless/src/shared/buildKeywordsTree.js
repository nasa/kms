import { getNarrowers } from './getNarrowers'

/**
 * Builds a hierarchical tree structure of keywords based on their relationships.
 *
 * @async
 * @function buildKeywordsTree
 * @param {Object} rootNode - The starting node for building the tree.
 * @param {Object} narrowersMap - A map containing narrower terms for each keyword.
 * @returns {Promise<Object>} The tree node object representing the hierarchical structure.
 *
 * @example
 * const rootNode = {
 *   narrowerPrefLabel: 'Science Keywords',
 *   uri: 'https://gcmd.earthdata.nasa.gov/kms/concept/e9f67a66-e9fc-435c-b720-ae32a2c3d8f7'
 * };
 *
 * const narrowersMap = {
 *   'https://gcmd.earthdata.nasa.gov/kms/concept/e9f67a66-e9fc-435c-b720-ae32a2c3d8f7': [
 *     { narrowerPrefLabel: 'EARTH SCIENCE SERVICES', uri: 'https://gcmd.earthdata.nasa.gov/kms/concept/894f9116-ae3c-40b6-981d-5113de961710' },
 *     { narrowerPrefLabel: 'EARTH SCIENCE', uri: 'https://gcmd.earthdata.nasa.gov/kms/concept/e9f67a66-e9fc-435c-b720-ae32a2c3d8f5' }
 *   ],
 *   'https://gcmd.earthdata.nasa.gov/kms/concept/e9f67a66-e9fc-435c-b720-ae32a2c3d8f5': [
 *     { narrowerPrefLabel: 'ATMOSPHERE', uri: 'https://gcmd.earthdata.nasa.gov/kms/concept/c47f6052-634e-40ef-a5ac-13f69f6f4c2a' },
 *     { narrowerPrefLabel: 'OCEANS', uri: 'https://gcmd.earthdata.nasa.gov/kms/concept/91697b7d-8f2b-4954-850e-61d5f61c867d' }
 *   ]
 * };
 *
 * const tree = await buildKeywordsTree(rootNode, narrowersMap);
 * // Returns:
 * // {
 * //   key: 'e9f67a66-e9fc-435c-b720-ae32a2c3d8f7',
 * //   title: 'Science Keywords',
 * //   children: [
 * //     {
 * //       key: '894f9116-ae3c-40b6-981d-5113de961710',
 * //       title: 'EARTH SCIENCE SERVICES',
 * //       children: []
 * //     },
 * //     {
 * //       key: 'e9f67a66-e9fc-435c-b720-ae32a2c3d8f5',
 * //       title: 'EARTH SCIENCE',
 * //       children: [
 * //         { key: 'c47f6052-634e-40ef-a5ac-13f69f6f4c2a', title: 'ATMOSPHERE', children: [] },
 * //         { key: '91697b7d-8f2b-4954-850e-61d5f61c867d', title: 'OCEANS', children: [] }
 * //       ]
 * //     }
 * //   ]
 * // }
 *
 * @throws {Error} If there's an issue fetching narrower terms or building the tree.
 *
* @todo Implement handling for circular relationships to prevent infinite recursion
 *       while still allowing for multiple occurrences of the same node in different
 *       branches of the tree. This could involve tracking the path of each node
 *       and only preventing recursion when the exact path repeats, rather than
 *       when a node is revisited in a different context. Consider using a
 *       depth-limited search or implementing a maximum depth to ensure
 *       termination in case of unforeseen circular relationships.
 *
 * @see {@link getNarrowers}
 */
export const buildKeywordsTree = async (rootNode, narrowersMap) => {
  // Extract properties from the root node
  const { narrowerPrefLabel, uri } = rootNode
  const uuid = uri?.split('/').pop()

  // Create the tree node structure
  const treeNode = {
    key: uuid,
    title: narrowerPrefLabel,
    children: []
  }

  // Get the narrower terms for the current node
  const narrowers = await getNarrowers(uri, narrowersMap)

  // Recursively build tree for each narrower term
  const childNodes = await Promise.all(
    narrowers.map((narrower) => buildKeywordsTree(narrower, narrowersMap))
  )

  // Filter out any null children (already processed nodes)
  treeNode.children = childNodes.filter(Boolean)

  return treeNode
}
