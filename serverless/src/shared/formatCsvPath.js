/**
 * Formats a CSV path based on the given scheme and parameters.
 *
 * This function adjusts the path array to match the expected length for different schemes,
 * adding empty spaces or modifying the array as needed.
 *
 * @param {string} scheme - The scheme to use for formatting (e.g., 'platforms', 'sciencekeywords', 'providers')
 * @param {number} csvHeadersCount - The total number of CSV headers
 * @param {string[]} path - The current path array to be formatted
 * @param {boolean} isLeaf - Indicates whether the current node is a leaf node
 * @returns {string[]} The formatted path array
 */
export const formatCsvPath = (scheme, csvHeadersCount, path, isLeaf) => {
  // Handle 'platforms', 'instruments', and 'projects' schemes
  if (['platforms', 'instruments', 'projects'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 2

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    // Add spaces to non-leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push(' ')
      }

      return path
    }

    // Insert a space for leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && isLeaf) {
      path.splice(maxLevel - 2, 0, ' ')

      return path
    }
  }

  // Handle 'sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', and 'measurementname' schemes
  if (['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 1

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    // Add spaces if path is shorter than maxLevel
    if (maxLevel > path.length) {
      while (maxLevel > path.length) {
        path.push(' ')
      }

      return path
    }
  }

  // Handle 'providers' scheme
  if (['providers'].includes(scheme)) {
    const maxLevel = csvHeadersCount - 3

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    // Add spaces to non-leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push(' ')
      }

      return path
    }

    // Insert spaces for leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && isLeaf) {
      while (maxLevel > path.length) {
        path.splice(path.length - 1, 0, ' ')
      }

      return path
    }
  }

  // Return original path if no formatting is needed
  return path
}
