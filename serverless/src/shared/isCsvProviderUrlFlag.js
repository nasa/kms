/**
 * Array of valid CSV provider schemes.
 * Currently only includes 'providers', but can be expanded in the future.
 */
const validSchemes = ['providers']

/**
 * Checks if the given scheme is a valid CSV provider URL flag.
 *
 * @param {any} scheme - The scheme to check.
 * @returns {boolean} True if the scheme is a string and matches a valid scheme (case-insensitive), false otherwise.
 */
export const isCsvProviderUrlFlag = (scheme) => {
  // Check if scheme is a string and is in the array of valid CSV provider schemes
  if (typeof scheme === 'string' && validSchemes.includes(scheme.toLowerCase())) {
    return true
  }

  // If the scheme is not a string or not in the array, return false
  return false
}

// You might want to export validSchemes if it's used elsewhere in your application
export { validSchemes }
