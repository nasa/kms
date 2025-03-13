import { getNarrowers } from './getNarrowers'

/**
 * Builds a hierarchical tree structure of keywords based on their relationships.
 *
 * @param {Object} rootNode - The starting node for building the tree.
 * @param {Object} narrowersMap - A map containing narrower terms for each keyword.
 * @param {Set} processedNodes - A set to keep track of processed nodes.
 * @returns {Object|null} - The tree node object or null if already processed.
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
 * //   key: 'science-keywords',
 * //   title: 'Science Keywords',
 * //   children: [
 * //     {
 * //       key: 'earth-science-services',
 * //       title: 'EARTH SCIENCE SERVICES',
 * //       children: []
 * //     },
 * //     {
 * //       key: 'earth-science',
 * //       title: 'EARTH SCIENCE',
 * //       children: [
 * //         { key: 'atmosphere', title: 'ATMOSPHERE', children: [] },
 * //         { key: 'oceans', title: 'OCEANS', children: [] }
 * //       ]
 * //     }
 * //   ]
 * // }
 */
export const buildKeywordsTree = async (rootNode, narrowersMap, processedNodes = new Set()) => {
  // Extract properties from the root node
  const { narrowerPrefLabel, uri } = rootNode
  const uuid = uri?.split('/').pop()

  // Check if the node has already been processed to avoid circular references
  if (processedNodes.has(uri)) {
    return null
  }

  // Mark the current node as processed
  processedNodes.add(uri)

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
    narrowers.map((narrower) => buildKeywordsTree(narrower, narrowersMap, processedNodes))
  )

  // Filter out any null children (already processed nodes)
  treeNode.children = childNodes.filter(Boolean)

  return treeNode
}
