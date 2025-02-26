/**
 * Determines if a given scheme is a CSV provider URL flag.
 *
 * @param {string} scheme - The scheme to check.
 * @returns {boolean} True if the scheme is a CSV provider URL flag, false otherwise.
 */
export const isCsvProviderUrlFlag = (scheme) => {
  // Check if the scheme is in the array of valid CSV provider schemes
  if (['providers'].includes(scheme)) {
    return true
  }

  // If the scheme is not in the array, return false
  return false
}
