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
 *   narrowerPrefLabel: 'Animals',
 *   uri: 'http://example.com/keywords/animals'
 * };
 *
 * const narrowersMap = {
 *   'http://example.com/keywords/animals': [
 *     { narrowerPrefLabel: 'Mammals', uri: 'http://example.com/keywords/mammals' },
 *     { narrowerPrefLabel: 'Birds', uri: 'http://example.com/keywords/birds' }
 *   ],
 *   'http://example.com/keywords/mammals': [
 *     { narrowerPrefLabel: 'Dogs', uri: 'http://example.com/keywords/dogs' },
 *     { narrowerPrefLabel: 'Cats', uri: 'http://example.com/keywords/cats' }
 *   ]
 * };
 *
 * const tree = await buildKeywordsTree(rootNode, narrowersMap);
 * // Returns:
 * // {
 * //   key: 'animals',
 * //   title: 'Animals',
 * //   children: [
 * //     {
 * //       key: 'mammals',
 * //       title: 'Mammals',
 * //       children: [
 * //         { key: 'dogs', title: 'Dogs', children: [] },
 * //         { key: 'cats', title: 'Cats', children: [] }
 * //       ]
 * //     },
 * //     { key: 'birds', title: 'Birds', children: [] }
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
