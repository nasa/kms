/**
 * @file filterKeywordTree.js
 * @description This file contains utility functions for filtering a keyword tree based on a given filter.
 */

/**
 * Checks if a title matches the given filter.
 *
 * @param {string} title - The title to check.
 * @param {string} filter - The filter to match against.
 * @returns {boolean} True if the title matches the filter, false otherwise.
 *
 * @example
 * matchesFilter('Hello World', 'world') // Returns true
 * matchesFilter('Hello World', 'foo') // Returns false
 * matchesFilter('Hello World', '') // Returns true
 */
export const matchesFilter = (title, filter) => {
  if (!filter) return true

  return title.toLowerCase().includes(filter.toLowerCase())
}

/**
 * Filters a keyword tree based on the given filter.
 *
 * @param {Object} node - The root node of the keyword tree.
 * @param {string} filter - The filter to apply.
 * @returns {Object|null} The filtered tree node, or null if the node doesn't match the filter.
 *
 * @example
 * const tree = {
 *   title: 'Root',
 *   children: [
 *     { title: 'Child 1', children: [] },
 *     { title: 'Child 2', children: [{ title: 'Grandchild', children: [] }] }
 *   ]
 * }
 *
 * filterKeywordTree(tree, 'child')
 * // Returns:
 * // {
 * //   title: 'Root',
 * //   children: [
 * //     { title: 'Child 1', children: [] },
 * //     { title: 'Child 2', children: [{ title: 'Grandchild', children: [] }] }
 * //   ]
 * // }
 *
 * filterKeywordTree(tree, 'grandchild')
 * // Returns:
 * // {
 * //   title: 'Root',
 * //   children: [
 * //     { title: 'Child 2', children: [{ title: 'Grandchild', children: [] }] }
 * //   ]
 * // }
 */
export const filterKeywordTree = (node, filter) => {
  if (!node) return null

  const filteredChildren = node.children
    ? node.children
      .map((child) => filterKeywordTree(child, filter))
      .filter((child) => child !== null)
    : []

  if (matchesFilter(node.title, filter) || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren
    }
  }

  return null
}
