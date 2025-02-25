/**
 * Determines if a long name flag should be used for CSV generation based on the scheme.
 * @param {string} scheme - The scheme to check.
 * @returns {boolean} - True if the scheme requires a long name flag, false otherwise.
 */
const getCsvLongNameFlag = (scheme) => {
  // Check if the scheme is in the list of schemes that require long names
  if (['platforms', 'instruments', 'projects', 'providers', 'idnnode'].includes(scheme)) {
    return true
  }

  // Return false for schemes not in the list
  return false
}

// Export the function as the default export
export default getCsvLongNameFlag
