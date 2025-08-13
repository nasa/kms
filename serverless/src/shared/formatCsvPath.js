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
 *
 * @example
 * // For 'platforms' scheme
 * formatCsvPath('platforms', 5, ['Level1', 'Level2'], false)
 * // Returns: ['Level1', 'Level2', '']
 *
 * @example
 * // For 'sciencekeywords' scheme
 * formatCsvPath('sciencekeywords', 4, ['Category', 'Topic'], false)
 * // Returns: ['Category', 'Topic', '']
 *
 * @example
 * // For 'providers' scheme
 * formatCsvPath('providers', 6, ['Provider1', 'Provider2'], true)
 * // Returns: ['Provider1', 'Provider2', '', '']
 *
 * @example
 * // For an unhandled scheme
 * formatCsvPath('unknown', 3, ['Item1', 'Item2'], false)
 * // Returns: ['Item1', 'Item2']
 */
export const formatCsvPath = (scheme, csvHeadersCount, path, isLeaf) => {
  // Handle 'platforms', 'instruments', and 'projects' schemes
  if (['platforms', 'instruments', 'projects'].includes(scheme.toLowerCase())) {
    const maxLevel = csvHeadersCount - 2 // Max level up to long name, uuid

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    while (maxLevel > path.length) {
      if (!isLeaf) {
        path.push('') // Add empty columns to end
      } else {
        path.splice(path.length - 1, 0, '') // Add empty columns before short name
      }
    }

    return path
  }

  // Handle 'sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', and 'measurementname' schemes
  if (['sciencekeywords', 'chronounits', 'locations', 'discipline', 'rucontenttype', 'measurementname'].includes(scheme.toLowerCase())) {
    const maxLevel = csvHeadersCount - 1

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    // Add empty columns if path is shorter than maxLevel
    if (maxLevel > path.length) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }
  }

  // Handle 'providers' scheme
  if (['providers'].includes(scheme.toLowerCase())) {
    const maxLevel = csvHeadersCount - 3

    // Return if path length matches maxLevel
    if (maxLevel === path.length) {
      return path
    }

    // Add empty columns to non-leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && !isLeaf) {
      while (maxLevel > path.length) {
        path.push('')
      }

      return path
    }

    // Insert empty columns for leaf nodes if path is shorter than maxLevel
    if ((maxLevel > path.length) && isLeaf) {
      while (maxLevel > path.length) {
        path.splice(path.length - 1, 0, '')
      }

      return path
    }
  }

  // Return original path if no formatting is needed
  return path
}
