/**
 * Recursively sorts an array of keyword nodes based on their titles, except for the root level nodes.
 *
 * @param {Array} nodes - The array of keyword nodes to be sorted.
 * @param {boolean} [isRoot=true] - Indicates whether the current level is the root level.
 * @returns {Array} A new array of sorted keyword nodes.
 *
 * @example
 * // Sorting a flat list of nodes
 * const flatNodes = [
 *   { title: "C" },
 *   { title: "A" },
 *   { title: "B" }
 * ];
 * const sortedFlatNodes = sortKeywordNodes(flatNodes, false);
 * // Result: [{ title: "A" }, { title: "B" }, { title: "C" }]
 *
 * @example
 * // Sorting nodes with children
 * const nestedNodes = [
 *   {
 *     title: "Parent B",
 *     children: [
 *       { title: "Child B2" },
 *       { title: "Child B1" }
 *     ]
 *   },
 *   {
 *     title: "Parent A",
 *     children: [
 *       { title: "Child A2" },
 *       { title: "Child A1" }
 *     ]
 *   }
 * ];
 * const sortedNestedNodes = sortKeywordNodes(nestedNodes);
 * // Result: [
 * //   {
 * //     title: "Parent B",
 * //     children: [
 * //       { title: "Child B1" },
 * //       { title: "Child B2" }
 * //     ]
 * //   },
 * //   {
 * //     title: "Parent A",
 * //     children: [
 * //       { title: "Child A1" },
 * //       { title: "Child A2" }
 * //     ]
 * //   }
 * // ]
 */
export const sortKeywordNodes = (nodes, isRoot = true) => {
  if (!Array.isArray(nodes)) return nodes

  return nodes.map((node) => {
    if (node.children && Array.isArray(node.children)) {
      return {
        ...node,
        children: sortKeywordNodes(node.children, false)
      }
    }

    return node
  }).sort((a, b) => {
    if (isRoot) return 0 // Don't sort root level nodes

    return a.title.localeCompare(b.title)
  })
}
