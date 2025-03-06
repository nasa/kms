import { toTitleCase } from './toTitleCase'
/**
 * Filters the science keywords tree by returning only the child with the specified title as the new root.
 * The title comparison is case-insensitive, and the returned title is properly capitalized.
 *
 * @param {Object} data - The science keywords tree object.
 * @param {string} titleToKeep - The title of the child to keep as the new root.
 * @returns {Object|null} The filtered science keywords tree with the specified child as the new root, or null if not found.
 *
 * @example
 * const scienceKeywordsTree = {
 *   key: "1eb0ea0a-312c-4d74-8d42-6f1ad758f999",
 *   title: "Science Keywords",
 *   children: [
 *     {
 *       key: "894f9116-ae3c-40b6-981d-5113de961710",
 *       title: "EARTH SCIENCE SERVICES",
 *       children: []
 *     },
 *     {
 *       key: "894f9116-ds34-40b6-981d-5113de961712",
 *       title: "EARTH SCIENCE",
 *       children: []
 *     }
 *   ]
 * };
 *
 * const filteredTree = filterScienceKeywordsTree(scienceKeywordsTree, "EARTH SCIENCE");
 *
 * console.log(filteredTree);
 * // Output:
 * // {
 * //   key: "894f9116-ds34-40b6-981d-5113de961712",
 * //   title: "Earth Science",
 * //   children: []
 * // }
 *
 * @example
 * // If the title doesn't match any children, the result will be null
 * const emptyFilteredTree = filterScienceKeywordsTree(scienceKeywordsTree, "SPACE SCIENCE");
 *
 * console.log(emptyFilteredTree);
 * // Output: null
 */
export const filterScienceKeywordsTree = (data, titleToKeep) => {
  if (data.children && data.children.length > 0) {
    // eslint-disable-next-line max-len
    const foundChild = data.children.find((child) => child.title.toLowerCase() === titleToKeep.toLowerCase())

    if (foundChild) {
      return {
        ...foundChild,
        title: toTitleCase(foundChild.title)
      }
    }
  }

  return null
}
