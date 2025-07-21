/**
 * Determines if a long name flag should be used for CSV generation based on the scheme.
 * @param {string} scheme - The scheme to check.
 * @returns {boolean} - True if the scheme requires a long name flag, false otherwise.
 *
 * @example
 * // Returns true
 * isCsvLongNameFlag('platforms')
 *
 * @example
 * // Returns true
 * isCsvLongNameFlag('instruments')
 *
 * @example
 * // Returns false
 * isCsvLongNameFlag('users')
 *
 * @example
 * // Returns false
 * isCsvLongNameFlag('organizations')
 */
export const isCsvLongNameFlag = (scheme) => {
  // Check if the scheme is in the list of schemes that require long names
  if (['platforms', 'instruments', 'projects', 'providers', 'idnnode', 'dataformat'].includes(scheme)) {
    return true
  }

  // Return false for schemes not in the list
  return false
}
